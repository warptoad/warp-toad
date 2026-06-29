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
import { ensureCrsCacheVersion } from '$lib/utils/proof-generation.js';

export type AztecAccountMode = 'sandbox-test' | 'custom';

/**
 * Stages of the connect flow, used by the UI to show what's happening
 * while `connectAztecBrowserWallet()` runs. Testnet account deploy can take
 * ~1 minute (client-side proving), so a plain "Connecting..." spinner feels
 * broken - the UI pipes these stages through to a status line.
 */
export type AztecConnectStage =
	| 'pxe-init'
	| 'register-fpc'
	| 'account-setup'
	| 'account-deploy'
	| 'complete';

export type AztecConnectProgress = (stage: AztecConnectStage, message: string) => void;

const STAGE_MESSAGES: Record<AztecConnectStage, string> = {
	'pxe-init': 'Initializing Aztec PXE…',
	'register-fpc': 'Registering sponsored fee contract…',
	'account-setup': 'Setting up Schnorr account…',
	'account-deploy': 'Deploying account on Aztec (~1 min)…',
	'complete': 'Connected',
};

const ACCOUNT_MODE_KEY = 'warptoad:aztec:account-mode';
const CUSTOM_SECRET_KEY = 'warptoad:aztec:custom-secret';
const CUSTOM_SALT_KEY = 'warptoad:aztec:custom-salt';
const CUSTOM_SIGNING_KEY = 'warptoad:aztec:custom-signing-key';
// Marks a custom account as already deployed on chain, so we don't re-run the
// ~20s simulate + ClientIVC-prove cycle on every page reload only to have the
// node reject with "Existing nullifier". Value is the address string for
// traceability / future account-rotation.
const CUSTOM_DEPLOYED_KEY = 'warptoad:aztec:custom-deployed-address';

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
	const secretHex = localStorage.getItem(CUSTOM_SECRET_KEY);
	const saltHex = localStorage.getItem(CUSTOM_SALT_KEY);
	const signingHex = localStorage.getItem(CUSTOM_SIGNING_KEY);

	const have = { secret: !!secretHex, salt: !!saltHex, signing: !!signingHex };
	const allPresent = have.secret && have.salt && have.signing;
	const allMissing = !have.secret && !have.salt && !have.signing;

	// Refuse to silently regenerate when only some keys are missing - that would mint a
	// brand new wallet and lose access to the old one. Surface as an error so the user
	// can either restore from backup or explicitly reset.
	if (!allPresent && !allMissing) {
		throw new Error(
			`Aztec custom wallet keys are partially present (secret=${have.secret}, ` +
			`salt=${have.salt}, signing-key=${have.signing}). Refusing to regenerate to ` +
			`avoid silently minting a new wallet. Use "Reset custom key" to wipe the ` +
			`remaining keys and start fresh, or restore the missing keys from a backup.`,
		);
	}

	if (allMissing) {
		const secret = Fr.random();
		const salt = Fr.random();
		const signingKey = GrumpkinScalar.random();
		localStorage.setItem(CUSTOM_SECRET_KEY, secret.toString());
		localStorage.setItem(CUSTOM_SALT_KEY, salt.toString());
		localStorage.setItem(CUSTOM_SIGNING_KEY, signingKey.toString());
		return { secret, salt, signingKey };
	}

	return {
		secret: Fr.fromHexString(secretHex!),
		salt: Fr.fromHexString(saltHex!),
		signingKey: GrumpkinScalar.fromString(signingHex!),
	};
}

/** Wipe the locally-generated custom account. Forces a fresh one on next connect. */
export function clearCustomSecrets(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(CUSTOM_SECRET_KEY);
	localStorage.removeItem(CUSTOM_SALT_KEY);
	localStorage.removeItem(CUSTOM_SIGNING_KEY);
	localStorage.removeItem(CUSTOM_DEPLOYED_KEY);
}

/**
 * Serializable backup of a custom in-browser Aztec wallet. The three keys are
 * everything needed to re-derive the account on any device/browser; `address` is
 * informational (lets a restore label which wallet it is without re-deriving).
 */
export interface AztecWalletBackup {
	type: 'warptoad-aztec-wallet-backup';
	version: 1;
	address?: string;
	secret: string;
	salt: string;
	signingKey: string;
}

/**
 * Read the persisted custom secrets for backup. Returns null if no complete custom
 * key set exists in this browser (e.g. sandbox-test mode, or never connected).
 */
export function exportCustomSecrets(): AztecWalletBackup | null {
	if (typeof window === 'undefined') return null;
	const secret = localStorage.getItem(CUSTOM_SECRET_KEY);
	const salt = localStorage.getItem(CUSTOM_SALT_KEY);
	const signingKey = localStorage.getItem(CUSTOM_SIGNING_KEY);
	if (!secret || !salt || !signingKey) return null;
	return {
		type: 'warptoad-aztec-wallet-backup',
		version: 1,
		address: localStorage.getItem(CUSTOM_DEPLOYED_KEY) ?? undefined,
		secret,
		salt,
		signingKey,
	};
}

/**
 * Restore custom secrets from a parsed backup object (the JSON contents of an
 * exported file). Each field is parsed into its Aztec type first, so a malformed
 * file fails loudly here instead of bricking the next connect. Switches the account
 * mode to `custom` so the restored keys are actually used, and drops the stale
 * "already deployed" marker so connect re-checks on-chain state (the connect path's
 * Existing-nullifier catch makes a redundant redeploy attempt idempotent).
 */
export function importCustomSecrets(backup: unknown): void {
	if (typeof window === 'undefined') {
		throw new Error('Wallet restore is only available in the browser.');
	}
	if (typeof backup !== 'object' || backup === null) {
		throw new Error('Invalid backup file: expected a JSON object.');
	}
	const b = backup as Record<string, unknown>;
	const { secret, salt, signingKey } = b;
	if (
		typeof secret !== 'string' ||
		typeof salt !== 'string' ||
		typeof signingKey !== 'string'
	) {
		throw new Error('Invalid backup file: missing secret, salt, or signingKey.');
	}
	// Validate shapes - throws if the hex doesn't parse into the expected field types.
	try {
		Fr.fromHexString(secret);
		Fr.fromHexString(salt);
		GrumpkinScalar.fromString(signingKey);
	} catch {
		throw new Error('Invalid backup file: keys are not valid Aztec field elements.');
	}

	localStorage.setItem(CUSTOM_SECRET_KEY, secret);
	localStorage.setItem(CUSTOM_SALT_KEY, salt);
	localStorage.setItem(CUSTOM_SIGNING_KEY, signingKey);
	localStorage.removeItem(CUSTOM_DEPLOYED_KEY);
	setAccountMode('custom');
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
/**
 * Thrown by the auto-reconnect path when stored custom keys derive a different
 * address than the previously-deployed wallet (an Aztec account-contract upgrade,
 * e.g. v4 -> v5). The stale custom-key state has ALREADY been cleared by the time
 * this is thrown, so callers should surface a friendly one-time notice rather than
 * the loud manual guard.
 */
export class AztecUpgradeResetError extends Error {
	constructor(
		public readonly previousAddress: string,
		public readonly newAddress: string,
	) {
		super('Aztec wallet reset for upgrade (auto-reconnect)');
		this.name = 'AztecUpgradeResetError';
	}
}

export async function connectAztecBrowserWallet(
	options?: { onProgress?: AztecConnectProgress; autoResetOnDrift?: boolean },
): Promise<{ wallet: Wallet; address: string }> {
	const report = (stage: AztecConnectStage) =>
		options?.onProgress?.(stage, STAGE_MESSAGES[stage]);

	if (walletInstance) {
		const accounts = await walletInstance.getAccounts();
		const address = accounts[0]?.item.toString() ?? '';
		report('complete');
		return { wallet: walletInstance, address };
	}

	const nodeUrl = getAztecNodeUrl();
	const sandbox = isTestMode;

	// A CRS cached by an older bb.js on this origin (e.g. the pre-v5 site) is reused
	// by the prover and then rejected with "SrsInitSrs: invalid points_buf size ...
	// got 128", aborting the account-deploy ClientIVC proof below. Drop a stale
	// cache before the PXE's prover touches it. Mirrors the withdraw-path guard;
	// idempotent (runs at most once per page load).
	await ensureCrsCacheVersion();

	// 1. Build the embedded wallet (creates a lazy PXE under the hood).
	report('pxe-init');
	const wallet = await EmbeddedWallet.create(nodeUrl, {
		ephemeral: true,
		pxeConfig: { proverEnabled: !sandbox },
	});

	// 2. Sponsored FPC for fee payment.
	report('register-fpc');
	const sponsoredPFCContract = await getContractInstanceFromInstantiationParams(
		SponsoredFPCContractArtifact,
		{ salt: new Fr(SPONSORED_FPC_SALT) },
	);
	sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredPFCContract.address);
	await wallet.registerContract(sponsoredPFCContract, SponsoredFPCContractArtifact);

	// 3. Schnorr account from the chosen mode.
	report('account-setup');
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
	const address = accountManager.address.toString();

	// 4. Deploy the account if needed. Sandbox-test is pre-deployed; custom needs a deploy
	//    on first use. The PXE runs with `ephemeral: true`, so every page load rebuilds its
	//    in-memory state from scratch - we use a localStorage flag to remember that this
	//    address already went through the deploy flow, and skip the ~20s simulate + prove
	//    + rejected-by-node cycle on reconnects. The Existing-nullifier catch remains as a
	//    defensive net in case the flag is out of sync with chain state (e.g. cleared
	//    localStorage, user restored keys on a new device).
	//
	//    Pass `from: NO_FROM` so DeployAccountMethod routes through the self-deploy path
	//    (the account contract pays its own fee via AccountEntrypointMetaPaymentMethod) and
	//    simulation uses DefaultEntrypoint instead of looking the deployer up in walletDB.
	if (mode === 'custom') {
		// Drift guard: if these keys previously derived a different address, refuse to
		// switch silently. Most likely cause is an Aztec library bump that changed the
		// Schnorr account contract bytecode (and therefore the contract class id, which
		// is part of the address). The old wallet would be unreachable from this build,
		// so warn loudly instead of pretending it's a fresh account.
		const previousDeployedAddress = localStorage.getItem(CUSTOM_DEPLOYED_KEY);
		if (previousDeployedAddress && previousDeployedAddress !== address) {
			if (options?.autoResetOnDrift) {
				// Page-load auto-reconnect: don't make returning users hand-resolve the
				// v4->v5 address change. Clear the stale custom-key state so the next
				// connect mints a fresh v5 wallet, and signal the caller to show a
				// one-time notice instead of the loud manual guard below.
				clearCustomSecrets();
				throw new AztecUpgradeResetError(previousDeployedAddress, address);
			}
			throw new Error(
				`Aztec wallet address drift detected. Stored keys now derive ${address}, ` +
				`but a previously-deployed wallet at ${previousDeployedAddress} exists for ` +
				`these keys. This usually means an Aztec library version was upgraded since ` +
				`you last connected; the old wallet's funds would be unreachable from this ` +
				`build. If you intend to abandon the old wallet, click "Reset custom key" to ` +
				`start fresh.`,
			);
		}

		const alreadyDeployed = previousDeployedAddress === address;

		if (!alreadyDeployed) {
			report('account-deploy');
			try {
				const deployMethod = await accountManager.getDeployMethod();
				await deployMethod.send({
					from: NO_FROM,
					fee: { paymentMethod: sponsoredPaymentMethod },
				});
				localStorage.setItem(CUSTOM_DEPLOYED_KEY, address);
			} catch (error: any) {
				// Aztec's `contextualizeError` wraps errors so the message might appear as
				// `[Error: Invalid tx: Existing nullifier]` or similar. Use `.includes()`
				// rather than `.startsWith()` to catch all wrapping shapes.
				const msg = String(error?.message ?? '') + ' ' + String(error?.cause?.message ?? '');
				if (msg.includes('Existing nullifier') || msg.includes('existing nullifier')) {
					// Already on chain - mark it so we skip the redeploy next reload.
					localStorage.setItem(CUSTOM_DEPLOYED_KEY, address);
				} else {
					throw new Error(`Failed to deploy custom Aztec account: ${msg}`, { cause: error });
				}
			}
		}
	}

	walletInstance = wallet;
	report('complete');
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
export async function autoReconnect(
	options?: { onProgress?: AztecConnectProgress; onUpgradeReset?: () => void },
): Promise<{ wallet: Wallet; address: string } | null> {
	if (typeof window === 'undefined') return null;

	const mode = getAccountMode();
	if (mode === 'custom') {
		// Bail cleanly unless all three keys are present. Auto-reconnect should stay
		// silent; if keys are partial, the user-clicked Connect path will surface the
		// strict-load error from `loadOrCreateCustomSecrets`.
		const haveAllKeys =
			!!localStorage.getItem(CUSTOM_SECRET_KEY) &&
			!!localStorage.getItem(CUSTOM_SALT_KEY) &&
			!!localStorage.getItem(CUSTOM_SIGNING_KEY);
		if (!haveAllKeys) return null;
	}

	try {
		// autoResetOnDrift: on a v4->v5 address change, clear the stale wallet and
		// surface a one-time notice instead of failing the reconnect. The loud guard
		// stays on the user-clicked Connect path (connectAztec without this flag).
		return await connectAztecBrowserWallet({ onProgress: options?.onProgress, autoResetOnDrift: true });
	} catch (error) {
		if (error instanceof AztecUpgradeResetError) {
			console.info('Aztec wallet reset for the v5 upgrade (stale keys cleared)');
			options?.onUpgradeReset?.();
			return null;
		}
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
