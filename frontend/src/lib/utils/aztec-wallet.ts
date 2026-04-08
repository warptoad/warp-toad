/**
 * Aztec Browser Wallet
 *
 * In-browser embedded Aztec wallet that runs its own PXE inside the page via
 * `BrowserEmbeddedWallet` from `@aztec/wallets/embedded`. Replaces the
 * removed Azguard integration.
 *
 * Two account modes:
 *  - 'sandbox-test'  pre-deployed, pre-funded canonical sandbox test account
 *                    (INITIAL_TEST_SECRET_KEYS[0]). Zero-config first run on local dev.
 *  - 'custom'        a fresh Schnorr account derived from a locally-stored secret
 *                    (Fr.random() on first use, persisted to localStorage). On first
 *                    use the account is deployed via the sponsored FPC payment method.
 *
 * The mode is selected from `walletStore` (UI toggle) and persisted alongside.
 */

// Both the browser and node entrypoints of @aztec/wallets/embedded re-export their
// concrete class under the name `EmbeddedWallet`. At type-check time (Node) the alias
// resolves to NodeEmbeddedWallet; at runtime in the browser, Vite picks the browser
// conditional export and the same name resolves to BrowserEmbeddedWallet. Both share
// the same `static create(nodeOrUrl, options?)` signature.
import { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { Wallet } from '@aztec/aztec.js/wallet';
import { Fr, GrumpkinScalar } from '@aztec/aztec.js/fields';
import { NO_FROM } from '@aztec/aztec.js/account';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { getAztecChain, isTestMode } from '$lib/config/chains.js';

export type AztecAccountMode = 'sandbox-test' | 'custom';

const ACCOUNT_MODE_KEY = 'warptoad:aztec:account-mode';
const CUSTOM_SECRET_KEY = 'warptoad:aztec:custom-secret';
const CUSTOM_SALT_KEY = 'warptoad:aztec:custom-salt';
const CUSTOM_SIGNING_KEY = 'warptoad:aztec:custom-signing-key';

// Canonical sandbox test account #0 (matches @aztec/accounts/testing INITIAL_TEST_*).
// Pre-deployed and pre-funded by the Aztec sandbox at startup; safe to hardcode.
const SANDBOX_TEST_SECRET = '0x2153536ff6628eee01cf4024889ff977a18d9fa61d0e414422f7681cf085c281';
const SANDBOX_TEST_SALT = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Module-level cache: building a PXE in the browser is expensive (lazy WASM, IndexedDB),
// we want one instance per page lifetime.
let walletInstance: Wallet | null = null;
let sponsoredPaymentMethod: SponsoredFeePaymentMethod | null = null;

// ============================================================================
// Account mode persistence
// ============================================================================

export function getAccountMode(): AztecAccountMode {
	if (typeof window === 'undefined') return 'sandbox-test';
	const stored = localStorage.getItem(ACCOUNT_MODE_KEY) as AztecAccountMode | null;
	if (stored === 'sandbox-test' || stored === 'custom') return stored;
	// Default: sandbox-test in dev mode, custom on testnet
	return isTestMode ? 'sandbox-test' : 'custom';
}

export function setAccountMode(mode: AztecAccountMode): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(ACCOUNT_MODE_KEY, mode);
}

function loadOrCreateCustomSecrets(): { secret: Fr; salt: Fr; signingKey: GrumpkinScalar } {
	let secretHex = localStorage.getItem(CUSTOM_SECRET_KEY);
	let saltHex = localStorage.getItem(CUSTOM_SALT_KEY);
	let signingHex = localStorage.getItem(CUSTOM_SIGNING_KEY);

	if (!secretHex || !saltHex || !signingHex) {
		const secret = Fr.random();
		const salt = Fr.random();
		const signingKey = GrumpkinScalar.random();
		secretHex = secret.toString();
		saltHex = salt.toString();
		signingHex = signingKey.toString();
		localStorage.setItem(CUSTOM_SECRET_KEY, secretHex);
		localStorage.setItem(CUSTOM_SALT_KEY, saltHex);
		localStorage.setItem(CUSTOM_SIGNING_KEY, signingHex);
	}

	return {
		secret: Fr.fromHexString(secretHex),
		salt: Fr.fromHexString(saltHex),
		signingKey: GrumpkinScalar.fromString(signingHex),
	};
}

/** Wipe the locally-generated custom account. Forces a fresh one on next connect. */
export function clearCustomSecrets(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(CUSTOM_SECRET_KEY);
	localStorage.removeItem(CUSTOM_SALT_KEY);
	localStorage.removeItem(CUSTOM_SIGNING_KEY);
}

// ============================================================================
// Wallet lifecycle
// ============================================================================

/**
 * Returns the configured Aztec node URL (sandbox in dev mode, devnet/testnet otherwise).
 */
export function getAztecNodeUrl(): string {
	const chain = getAztecChain('Aztec');
	if (!chain) throw new Error('Aztec chain not configured');
	return chain.nodeUrl;
}

/**
 * Browser-side wallet is always available; no extension required.
 */
export function isAztecWalletAvailable(): boolean {
	return typeof window !== 'undefined';
}

/**
 * Connect (or reconnect) the in-browser Aztec wallet.
 *
 * Steps:
 *  1. Spin up `BrowserEmbeddedWallet` against the configured node URL.
 *     PXE state is ephemeral within the page (in-memory) - we cache the
 *     instance at module level so a single page session shares one PXE.
 *  2. Register the sponsored FPC contract instance + payment method, used
 *     for any tx that needs fees (mandatory on testnet, harmless on sandbox).
 *  3. Materialize the Schnorr account using either the canonical sandbox
 *     test secret or the user's persisted custom secret.
 *  4. For custom mode, ensure the account is deployed on chain (try-catch
 *     "Existing nullifier" so reconnects are idempotent).
 */
export async function connectAztecBrowserWallet(): Promise<{ wallet: Wallet; address: string }> {
	if (walletInstance) {
		const accounts = await walletInstance.getAccounts();
		const address = accounts[0]?.item.toString() ?? '';
		return { wallet: walletInstance, address };
	}

	const nodeUrl = getAztecNodeUrl();
	const sandbox = isTestMode;

	// 1. Build the embedded wallet (creates a lazy PXE under the hood).
	const wallet = await EmbeddedWallet.create(nodeUrl, {
		ephemeral: true,
		pxeConfig: { proverEnabled: !sandbox },
	});

	// 2. Sponsored FPC for fee payment.
	const sponsoredPFCContract = await getContractInstanceFromInstantiationParams(
		SponsoredFPCContractArtifact,
		{ salt: new Fr(SPONSORED_FPC_SALT) },
	);
	sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
	await wallet.registerContract(sponsoredPFCContract, SponsoredFPCContractArtifact);

	// 3. Schnorr account from the chosen mode.
	const mode = getAccountMode();
	let secret: Fr;
	let salt: Fr;
	let signingKey: GrumpkinScalar | undefined;

	if (mode === 'sandbox-test') {
		secret = Fr.fromHexString(SANDBOX_TEST_SECRET);
		salt = Fr.fromHexString(SANDBOX_TEST_SALT);
		signingKey = undefined; // sandbox test accounts derive their signing key
	} else {
		const custom = loadOrCreateCustomSecrets();
		secret = custom.secret;
		salt = custom.salt;
		signingKey = custom.signingKey;
	}

	const accountManager = await wallet.createSchnorrAccount(secret, salt, signingKey);

	// 4. Deploy the account if needed. Sandbox-test is pre-deployed; custom needs a deploy.
	//    Pass `from: NO_FROM` so DeployAccountMethod routes through the self-deploy path
	//    (the account contract pays its own fee via AccountEntrypointMetaPaymentMethod) and
	//    simulation uses DefaultEntrypoint instead of looking the deployer up in walletDB.
	//    Swallow "Existing nullifier" so reconnects are idempotent.
	if (mode === 'custom') {
		try {
			const deployMethod = await accountManager.getDeployMethod();
			await deployMethod.send({
				from: NO_FROM,
				fee: { paymentMethod: sponsoredPaymentMethod },
			});
		} catch (error: any) {
			// Aztec's `contextualizeError` wraps errors so the message might appear as
			// `[Error: Invalid tx: Existing nullifier]` or similar. Use `.includes()`
			// rather than `.startsWith()` to catch all wrapping shapes.
			const msg = String(error?.message ?? '') + ' ' + String(error?.cause?.message ?? '');
			if (!msg.includes('Existing nullifier') && !msg.includes('existing nullifier')) {
				throw new Error(`Failed to deploy custom Aztec account: ${msg}`, { cause: error });
			}
			// Account already deployed on the sandbox - safe to proceed.
		}
	}

	walletInstance = wallet;
	const address = accountManager.address.toString();
	return { wallet, address };
}

export function getWalletInstance(): Wallet | null {
	return walletInstance;
}

export function getSponsoredPaymentMethod(): SponsoredFeePaymentMethod | null {
	return sponsoredPaymentMethod;
}

export function isWalletConnected(): boolean {
	return walletInstance !== null;
}

export async function disconnectAztecWallet(): Promise<void> {
	if (walletInstance && typeof (walletInstance as any).stop === 'function') {
		try {
			await (walletInstance as any).stop();
		} catch (error) {
			console.warn('Error stopping Aztec wallet PXE:', error);
		}
	}
	walletInstance = null;
	sponsoredPaymentMethod = null;
}

/**
 * Auto-reconnect on page load. Returns null if there's nothing to reconnect.
 *
 * For sandbox-test mode, the canonical account is always available, so auto-reconnect
 * actually re-creates the wallet. For custom mode, we only reconnect if a custom
 * secret was previously persisted to localStorage (otherwise we'd silently mint a
 * fresh account on every page load, which would be confusing).
 */
export async function autoReconnect(): Promise<{ wallet: Wallet; address: string } | null> {
	if (typeof window === 'undefined') return null;

	const mode = getAccountMode();
	if (mode === 'custom' && !localStorage.getItem(CUSTOM_SECRET_KEY)) {
		return null;
	}

	try {
		return await connectAztecBrowserWallet();
	} catch (error) {
		console.debug('Aztec auto-reconnect failed:', error);
		return null;
	}
}

/**
 * No-op event listener placeholder. Browser embedded wallet is purely in-process,
 * so there's nothing equivalent to MetaMask's `accountsChanged`. Kept for API parity.
 */
export function onConnectionChanged(
	_onConnected: () => void,
	_onDisconnected: () => void,
): () => void {
	return () => {};
}
