import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { randomUUID } from 'crypto';
import type {
  RelayerInfo,
  WithdrawRequest,
  RelayOperation,
  RelayResponse
} from '../types/index.js';
import { checkProfitability, validateFeeFactor } from '../utils/profitability.js';

// WarpToadCore ABI - just the mint function
const WARP_TOAD_CORE_ABI = [
  'function mint(uint256 _nullifier, uint256 _amount, uint256 _gigaRoot, uint256 _localRoot, uint256 _feeFactor, uint256 _priorityFee, uint256 _maxFee, address _relayer, address _recipient, bytes memory _poof) public'
];

export function createRelayRouter(
  providers: Map<number, ethers.Provider>,
  wallets: Map<number, ethers.Wallet>,
  config: {
    minFeeFactor: number;
    maxFeeFactor: number;
    minProfitUsd: number;
  }
): Router {
  const router = Router();

  // In-memory storage for operations (replace with DB in production)
  const operations = new Map<string, RelayOperation>();

  /**
   * GET /relay/info
   * Returns relayer information including address and fee requirements
   * Query params: chainId (optional, defaults to L1)
   */
  router.get('/info', async (req: Request, res: Response) => {
    try {
      const chainId = parseInt(req.query.chainId as string || '11155111'); // Default to Sepolia
      
      const provider = providers.get(chainId);
      const wallet = wallets.get(chainId);
      
      if (!provider || !wallet) {
        return res.status(400).json({
          ok: false,
          error: `Chain ID ${chainId} not supported. Supported: ${Array.from(providers.keys()).join(', ')}`
        });
      }

      const feeData = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || 0n;

      // Estimate gas cost for a typical mint transaction
      const estimatedGasUnits = 250000n; // Conservative estimate
      const estimatedGasCost = gasPrice * estimatedGasUnits;

      const info: RelayerInfo = {
        relayerAddress: wallet.address,
        minFeeFactor: config.minFeeFactor, // 0 = altruistic
        maxFeeFactor: config.maxFeeFactor, // 0 = altruistic
        currentGasPrice: gasPrice.toString(),
        estimatedGasCost: estimatedGasCost.toString()
      };

      res.json({
        ok: true,
        ...info
      });
    } catch (error) {
      console.error('[/relay/info] Error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to fetch relayer info'
      });
    }
  });

  /**
   * POST /relay/withdraw
   * Submit a withdrawal request to be relayed
   * Body must include: chainId (target chain)
   */
  router.post('/withdraw', async (req: Request, res: Response) => {
    try {
      const request: WithdrawRequest = req.body;

      console.log('=== RELAY REQUEST RECEIVED ===');
      console.log('chainId:', request.chainId);
      console.log('feeFactor:', request.feeFactor);
      console.log('amount:', request.amount);
      console.log('priorityFee:', request.priorityFee);
      console.log('maxFee:', request.maxFee);
      console.log('relayer:', request.relayer);
      console.log('recipient:', request.recipient);
      console.log('=============================');

      // Validate request
      if (!request.contractAddress || !request.proof || !request.nullifier || !request.chainId) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: contractAddress, proof, nullifier, chainId'
        });
      }

      // Get provider and wallet for this chain
      const chainId = parseInt(request.chainId);
      const provider = providers.get(chainId);
      const wallet = wallets.get(chainId);
      
      if (!provider || !wallet) {
        return res.status(400).json({
          ok: false,
          error: `Chain ID ${chainId} not supported. Supported: ${Array.from(providers.keys()).join(', ')}`
        });
      }

      // Validate that relayer address matches this service
      if (request.relayer.toLowerCase() !== wallet.address.toLowerCase()) {
        return res.status(400).json({
          ok: false,
          error: `Invalid relayer address. Expected ${wallet.address}, got ${request.relayer}`
        });
      }

      // Parse amounts
      const feeFactor = BigInt(0);
      const amount = BigInt(request.amount);
      const priorityFee = BigInt(request.priorityFee);
      const maxFee = BigInt(request.maxFee);

      console.log('Parsed feeFactor as BigInt:', feeFactor);
      console.log('Parsed amount as BigInt:', amount);

      // Validate fee factor is within range
      const feeValidation = validateFeeFactor(feeFactor, config.minFeeFactor, config.maxFeeFactor);
      if (!feeValidation.isValid) {
        return res.status(400).json({
          ok: false,
          error: feeValidation.reason
        });
      }

      // Check profitability
      const profitCheck = await checkProfitability(
        feeFactor,
        amount,
        priorityFee,
        provider,
        config.minProfitUsd
      );

      //skip profitability check for now
      /*if (!profitCheck.isProfitable) {
        return res.status(400).json({
          ok: false,
          error: `Transaction not profitable for relayer: ${profitCheck.reason}`
        });
      }*/

      // Create operation
      const operationId = randomUUID();
      const operation: RelayOperation = {
        operationId,
        status: 'pending',
        startTime: Date.now()
      };
      operations.set(operationId, operation);

      // Submit transaction asynchronously
      submitRelayTransaction(
        operationId,
        request,
        provider,
        wallet,
        operations,
        config
      ).catch(error => {
        console.error(`[${operationId}] Transaction submission failed:`, error);
        const op = operations.get(operationId);
        if (op) {
          op.status = 'failed';
          op.error = String(error);
          op.endTime = Date.now();
        }
      });

      // Return immediately with operation ID
      const response: RelayResponse = {
        ok: true,
        operationId,
        status: 'pending',
        estimatedConfirmationTime: 30 // seconds
      };

      res.json(response);
    } catch (error) {
      console.error('[/relay/withdraw] Error:', error);
      res.status(500).json({
        ok: false,
        error: 'Internal server error'
      });
    }
  });

  /**
   * GET /relay/status/:operationId
   * Check the status of a relay operation
   */
  router.get('/status/:operationId', (req: Request, res: Response) => {
    const { operationId } = req.params;
    const operation = operations.get(operationId);

    if (!operation) {
      return res.status(404).json({
        ok: false,
        error: 'Operation not found'
      });
    }

    res.json({
      ok: true,
      ...operation
    });
  });

  return router;
}

/**
 * Submit the relay transaction to the blockchain
 */
async function submitRelayTransaction(
  operationId: string,
  request: WithdrawRequest,
  provider: ethers.Provider,
  wallet: ethers.Wallet,
  operations: Map<string, RelayOperation>,
  config: {
    minFeeFactor: number;
    maxFeeFactor: number;
    minProfitUsd: number;
  }
): Promise<void> {
  const operation = operations.get(operationId);
  if (!operation) return;

  try {
    console.log(`[${operationId}] Submitting relay transaction...`);
    operation.status = 'validating';
    console.log("1");
    // Create contract instance
    const contract = new ethers.Contract(
      request.contractAddress,
      WARP_TOAD_CORE_ABI,
      wallet
    );
    console.log("2");
    // Prepare transaction
    operation.status = 'submitting';
    console.log("3");
    const tx = await contract.mint(
      request.nullifier,
      request.amount,
      request.gigaRoot,
      request.localRoot,
      request.feeFactor,
      request.priorityFee,
      request.maxFee,
      request.relayer,
      request.recipient,
      request.proof
    );

    console.log(`[${operationId}] Transaction submitted: ${tx.hash}`);
    operation.txHash = tx.hash;

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log(`[${operationId}] Transaction confirmed: ${tx.hash}`);
      operation.status = 'completed';
      operation.endTime = Date.now();
      operation.gasUsed = receipt.gasUsed.toString();

      // Calculate actual relayer fee from logs if available
      // For now, just mark as completed
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error(`[${operationId}] Error:`, error);
    console.log(
      request
    )
    operation.status = 'failed';
    operation.error = String(error);
    operation.endTime = Date.now();
    throw error;
  }
}
