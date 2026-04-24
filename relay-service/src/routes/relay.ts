import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import {
	getContract,
	parseAbi,
	type Address,
	type Hex,
} from 'viem';
import type { ChainBinding } from '../server.js';
import type {
	RelayerInfo,
	WithdrawRequest,
	RelayOperation,
	RelayResponse,
} from '../types/index.js';

/**
 * WarpToadCore.mint(...) — full ABI string for the only function we call.
 * Verified against backend/contracts/core/WarpToadCore.sol:143 (post-viem migration).
 */
const WARP_TOAD_MINT_ABI = parseAbi([
	'function mint(uint256 _nullifier, uint256 _amount, uint256 _gigaRoot, uint256 _localRoot, uint256 _feeFactor, uint256 _priorityFee, uint256 _maxFee, address _relayer, address _recipient, bytes _poof)',
]);

/**
 * Conservative gas-limit floor for `mint`. The actual cost is dominated by
 * verifier verification (~600-800k). We try `estimateContractGas` first and
 * only fall back to this floor if estimation fails.
 */
const GAS_FLOOR = 1_200_000n;

interface RouterConfig {
	minFeeFactor: number;
	maxFeeFactor: number;
	minProfitUsd: number;
}

/**
 * Pure in-process fee-bound check. Currently lenient for the altruistic
 * testnet flow: feeFactor=0 always passes, otherwise just check against
 * configured min/max.
 */
function validateFeeFactor(
	feeFactor: bigint,
	min: number,
	max: number,
): { ok: true } | { ok: false; reason: string } {
	if (feeFactor === 0n) return { ok: true };
	if (feeFactor < 0n) return { ok: false, reason: 'Fee factor cannot be negative' };
	const n = Number(feeFactor);
	if (max > 0 && (n < min || n > max)) {
		return { ok: false, reason: `Fee factor must be between ${min} and ${max}` };
	}
	return { ok: true };
}

export function createRelayRouter(
	bindings: Map<number, ChainBinding>,
	config: RouterConfig,
): Router {
	const router = Router();
	const operations = new Map<string, RelayOperation>();

	/**
	 * GET /relay/info?chainId=...
	 * Returns relayer address + fee bounds + an estimated gas-cost ceiling.
	 */
	router.get('/info', async (req: Request, res: Response) => {
		try {
			const chainId = parseInt((req.query.chainId as string) || '11155111');
			const binding = bindings.get(chainId);
			if (!binding) {
				return res.status(400).json({
					ok: false,
					error: `Chain ${chainId} not supported. Supported: ${Array.from(bindings.keys()).join(', ')}`,
				});
			}

			const gasPrice = await binding.publicClient.getGasPrice();
			const estimatedGasCost = gasPrice * GAS_FLOOR;

			const info: RelayerInfo = {
				relayerAddress: binding.walletClient.account!.address,
				minFeeFactor: config.minFeeFactor,
				maxFeeFactor: config.maxFeeFactor,
				currentGasPrice: gasPrice.toString(),
				estimatedGasCost: estimatedGasCost.toString(),
			};
			res.json({ ok: true, ...info });
		} catch (error) {
			console.error('[/relay/info] Error:', error);
			res.status(500).json({ ok: false, error: 'Failed to fetch relayer info' });
		}
	});

	/**
	 * POST /relay/withdraw
	 * Submit a withdrawal to be relayed. Returns immediately with an
	 * operationId; the actual tx is submitted asynchronously.
	 */
	router.post('/withdraw', async (req: Request, res: Response) => {
		try {
			const request: WithdrawRequest = req.body;
			console.log('=== RELAY REQUEST ===', {
				chainId: request.chainId,
				feeFactor: request.feeFactor,
				amount: request.amount,
				priorityFee: request.priorityFee,
				maxFee: request.maxFee,
				relayer: request.relayer,
				recipient: request.recipient,
			});

			if (!request.contractAddress || !request.proof || !request.nullifier || !request.chainId) {
				return res.status(400).json({
					ok: false,
					error: 'Missing required fields: contractAddress, proof, nullifier, chainId',
				});
			}

			const chainId = parseInt(request.chainId);
			const binding = bindings.get(chainId);
			if (!binding) {
				return res.status(400).json({
					ok: false,
					error: `Chain ${chainId} not supported. Supported: ${Array.from(bindings.keys()).join(', ')}`,
				});
			}

			// Sanity-check the relayer address matches this service's wallet.
			const ourAddress = binding.walletClient.account!.address;
			if (request.relayer.toLowerCase() !== ourAddress.toLowerCase()) {
				return res.status(400).json({
					ok: false,
					error: `Invalid relayer address. Expected ${ourAddress}, got ${request.relayer}`,
				});
			}

			// Parse + validate fee factor (use what the caller actually sent).
			const feeFactor = BigInt(request.feeFactor);
			const v = validateFeeFactor(feeFactor, config.minFeeFactor, config.maxFeeFactor);
			if (!v.ok) {
				return res.status(400).json({ ok: false, error: v.reason });
			}

			const operationId = randomUUID();
			const operation: RelayOperation = {
				operationId,
				status: 'pending',
				startTime: Date.now(),
			};
			operations.set(operationId, operation);

			// Fire-and-forget the actual tx. Errors are captured into the op state.
			submitRelayTransaction(operationId, request, binding, operations).catch((err) => {
				console.error(`[${operationId}] Submission failed:`, err);
				const op = operations.get(operationId);
				if (op) {
					op.status = 'failed';
					op.error = String(err);
					op.endTime = Date.now();
				}
			});

			const response: RelayResponse = {
				ok: true,
				operationId,
				status: 'pending',
				estimatedConfirmationTime: 30,
			};
			res.json(response);
		} catch (error) {
			console.error('[/relay/withdraw] Error:', error);
			res.status(500).json({ ok: false, error: 'Internal server error' });
		}
	});

	/**
	 * GET /relay/status/:operationId
	 */
	router.get('/status/:operationId', (req: Request, res: Response) => {
		const op = operations.get(req.params.operationId);
		if (!op) return res.status(404).json({ ok: false, error: 'Operation not found' });
		res.json({ ok: true, ...op });
	});

	return router;
}

/**
 * Submit the actual mint() tx and update operation state.
 */
async function submitRelayTransaction(
	operationId: string,
	request: WithdrawRequest,
	binding: ChainBinding,
	operations: Map<string, RelayOperation>,
): Promise<void> {
	const op = operations.get(operationId);
	if (!op) return;

	const { publicClient, walletClient, chain } = binding;
	const account = walletClient.account!;

	op.status = 'validating';

	const args: readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, Address, Address, Hex] = [
		BigInt(request.nullifier),
		BigInt(request.amount),
		BigInt(request.gigaRoot),
		BigInt(request.localRoot),
		BigInt(request.feeFactor),
		BigInt(request.priorityFee),
		BigInt(request.maxFee),
		request.relayer as Address,
		request.recipient as Address,
		request.proof as Hex,
	] as const;

	// Try to estimate gas first; on failure (e.g. proof verification reverts
	// in simulation), fall back to the floor so we still submit and let the
	// chain be the source of truth.
	let gasLimit: bigint = GAS_FLOOR;
	try {
		const estimated = await publicClient.estimateContractGas({
			address: request.contractAddress as Address,
			abi: WARP_TOAD_MINT_ABI,
			functionName: 'mint',
			args,
			account: account.address,
		});
		// 25% headroom on top of the estimate, never below the floor.
		gasLimit = estimated * 125n / 100n;
		if (gasLimit < GAS_FLOOR) gasLimit = GAS_FLOOR;
		console.log(`[${operationId}] gas estimate=${estimated} → limit=${gasLimit}`);
	} catch (err) {
		console.warn(`[${operationId}] estimateContractGas failed; using floor ${GAS_FLOOR}.`, (err as Error).message);
	}

	// EIP-1559 fee parameters. Use the user-supplied priorityFee and bound
	// maxFee at 100x priority (mirrors backend test pattern).
	const priorityFee = BigInt(request.priorityFee);
	const maxFee = priorityFee * 100n;

	op.status = 'submitting';
	console.log(`[${operationId}] sending mint() to ${request.contractAddress} on chain ${chain.id}`);

	const txHash = await walletClient.writeContract({
		chain,
		account,
		address: request.contractAddress as Address,
		abi: WARP_TOAD_MINT_ABI,
		functionName: 'mint',
		args,
		gas: gasLimit,
		maxPriorityFeePerGas: priorityFee,
		maxFeePerGas: maxFee,
	});

	op.txHash = txHash;
	console.log(`[${operationId}] tx submitted: ${txHash}`);

	const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
	if (receipt.status !== 'success') {
		throw new Error(`Transaction reverted: ${txHash}`);
	}

	op.status = 'completed';
	op.endTime = Date.now();
	op.gasUsed = receipt.gasUsed.toString();
	console.log(`[${operationId}] tx confirmed: ${txHash} (gasUsed=${receipt.gasUsed})`);
}
