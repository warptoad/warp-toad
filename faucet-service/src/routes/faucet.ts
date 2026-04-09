import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { isAddress, type Address } from "viem";
import type { ChainBinding } from "../server.js";
import type { LedgerStore } from "../ledger.js";

/**
 * Per-IP rate limit. The real anti-abuse is the per-(address, chainId) ledger
 * check, but a global IP limit softens drive-by abuse from someone scripting
 * a wallet generator.
 */
const claimLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: { ok: false, error: "Too many claim requests, slow down" },
});

export function createFaucetRouter(
	bindings: Map<number, ChainBinding>,
	ledger: LedgerStore,
	dripWei: bigint,
	faucetAddress: Address,
): Router {
	const router = Router();

	/**
	 * GET /faucet/info?address=0x...
	 * Per-chain claim status for the given address.
	 */
	router.get("/info", (req: Request, res: Response) => {
		const address = req.query.address as string | undefined;
		if (!address || !isAddress(address)) {
			return res.status(400).json({ ok: false, error: "Valid `address` query param required" });
		}

		const chains: Record<string, { claimed: boolean; txHash?: string; timestamp?: number }> = {};
		for (const chainId of bindings.keys()) {
			const claim = ledger.getClaim(address, chainId);
			chains[chainId.toString()] = claim
				? { claimed: true, txHash: claim.txHash, timestamp: claim.timestamp }
				: { claimed: false };
		}

		res.json({
			ok: true,
			address,
			dripAmountWei: dripWei.toString(),
			chains,
		});
	});

	/**
	 * POST /faucet/claim
	 * Body: { chainId: number, address: string }
	 * Sends one drip to `address` on `chainId` and records the claim.
	 */
	router.post("/claim", claimLimiter, async (req: Request, res: Response) => {
		try {
			const { chainId, address } = req.body ?? {};

			if (!chainId || typeof chainId !== "number") {
				return res.status(400).json({ ok: false, error: "Body must include numeric `chainId`" });
			}
			if (!address || !isAddress(address)) {
				return res.status(400).json({ ok: false, error: "Body must include a valid `address`" });
			}

			const binding = bindings.get(chainId);
			if (!binding) {
				return res.status(400).json({
					ok: false,
					error: `Chain ${chainId} not supported. Supported: ${Array.from(bindings.keys()).join(", ")}`,
				});
			}

			// Per-(address, chainId) one-shot limit.
			if (ledger.hasClaimed(address, chainId)) {
				const existing = ledger.getClaim(address, chainId);
				return res.status(409).json({
					ok: false,
					error: "Already claimed on this chain",
					previousClaim: existing,
				});
			}

			// Make sure the faucet has enough balance to send a drip.
			const balance = await binding.publicClient.getBalance({ address: faucetAddress });
			if (balance < dripWei) {
				return res.status(503).json({
					ok: false,
					error: `Faucet wallet out of funds on chain ${chainId}. Try again later.`,
				});
			}

			console.log(`[claim] ${address} on chain ${chainId}`);

			const txHash = await binding.walletClient.sendTransaction({
				account: binding.walletClient.account!,
				chain: binding.chain,
				to: address as Address,
				value: dripWei,
			});

			console.log(`[claim] tx submitted: ${txHash}`);

			// Record the claim BEFORE waiting for confirmation. If the user calls
			// /info before the tx is mined, they should still see "claimed". If
			// the tx ends up reverting (rare for a plain ETH transfer), they can
			// open a support ticket and we manually clear the ledger entry.
			ledger.recordClaim(address, chainId, txHash);

			// Wait for receipt so the response is meaningful.
			const receipt = await binding.publicClient.waitForTransactionReceipt({ hash: txHash });
			if (receipt.status !== "success") {
				return res.status(500).json({
					ok: false,
					error: `Tx reverted: ${txHash}`,
					txHash,
				});
			}

			console.log(`[claim] tx confirmed: ${txHash}`);
			res.json({
				ok: true,
				txHash,
				chainId,
				address,
				amountWei: dripWei.toString(),
			});
		} catch (err) {
			console.error("[/faucet/claim] Error:", err);
			res.status(500).json({ ok: false, error: (err as Error).message });
		}
	});

	return router;
}
