/**
 * Aztec → L1 burn + bridge + mint test
 *
 * Tests the cross-chain flow from Aztec L2 to Ethereum L1:
 * 1. Mint test tokens on Aztec
 * 2. Burn on Aztec with commitment
 * 3. Bridge Aztec note hash tree root to L1 via L2-to-L1 messaging
 * 4. Update giga root on L1
 * 5. Generate ZK proof and mint on L1
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import os from "os";

import {
  setupFullEnvironment,
  createCommitment,
  getTestFeeFactor,
  DEFAULT_FEE,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
} from "./helpers";
import { createProof, getProofInputs } from "../lib/proving";
import { bridgeBetweenL1AndL2 } from "../lib/bridging";

describe("Aztec → L1", () => {
  describe("deployment", () => {
    it("should deploy all contracts and wire them together", async () => {
      const { evm, aztec } = await setupFullEnvironment();

      const deployer = (await aztec.wallets[0].getAccounts())[0].item;
      const { result } = await aztec.warpToad.methods.get_l1_bridge_adapter().simulate({ from: deployer });
      const l1AdapterFromAztec = result.toString();
      assert.equal(
        l1AdapterFromAztec.toLowerCase(),
        (await evm.l1AztecBridgeAdapter!.getAddress()).toLowerCase(),
      );
    });
  });

  describe("burn on Aztec, mint on L1", () => {
    it("should burn on Aztec, bridge, and mint on L1 with ZK proof", async () => {
      const { evm, aztec, evmWallets, chainId } = await setupFullEnvironment();

      const [evmDeployer, evmRelayer, , evmRecipient] = evmWallets;
      const aztecDeployer = aztec.wallets[0];
      const aztecDeployerAddress = (await aztecDeployer.getAccounts())[0].item;

      // ── Mint test tokens on Aztec ─────────────────────────────
      await aztec.warpToad.methods
        .mint_for_testing(INITIAL_BALANCE, aztecDeployerAddress)
        .send({ from: aztecDeployerAddress });

      // ── Burn on Aztec ─────────────────────────────────────────
      const commitment = createCommitment(
        TEST_COMMITMENT_1.amount,
        chainId, // destination is L1
        TEST_COMMITMENT_1.secret,
        TEST_COMMITMENT_1.nullifierPreimage,
      );

      const { result: balancePre } = await aztec.warpToad.methods
        .balance_of(aztecDeployerAddress)
        .simulate({ from: aztecDeployerAddress });

      await aztec.warpToad.methods
        .burn(commitment.amount, commitment.destinationChainId, commitment.secret, commitment.nullifierPreimage)
        .send({ from: aztecDeployerAddress });

      const { result: balancePost } = await aztec.warpToad.methods
        .balance_of(aztecDeployerAddress)
        .simulate({ from: aztecDeployerAddress });
      assert.equal(balancePost, balancePre - commitment.amount, "Aztec balance should decrease");

      // ── Store local root on L1 and bridge ─────────────────────
      await (await evm.l1WarpToad.connect(evmDeployer).storeLocalRootInHistory()).wait();

      const localRootProviders = [await evm.l1WarpToad.getAddress(), await evm.l1AztecBridgeAdapter!.getAddress()];
      await bridgeBetweenL1AndL2(
        evmRelayer,
        evm.l1AztecBridgeAdapter,
        evm.gigaBridge,
        aztec.bridgeAdapter,
        aztec.warpToad,
        localRootProviders,
        [],
        {
          isAztec: true,
          PXE: aztec.pxe,
          sponsoredPaymentMethod: undefined,
          aztecNode: aztec.node,
          aztecWallet: aztecDeployer,
        },
      );

      // ── Generate proof and mint on L1 ─────────────────────────
      const feeFactor = getTestFeeFactor(chainId);

      const proofInputs = await getProofInputs(
        evm.gigaBridge,
        evm.l1WarpToad,     // destination
        aztec.warpToad,     // origin (Aztec)
        commitment.amount,
        feeFactor,
        DEFAULT_FEE.priorityFee,
        DEFAULT_FEE.maxFee,
        await evmRelayer.getAddress(),
        await evmRecipient.getAddress(),
        commitment.nullifierPreimage,
        commitment.secret,
        aztecDeployer,
        aztec.pxe,
        aztec.node,
      );

      const proof = await createProof(proofInputs, os.cpus().length);

      // ── Mint on L1 ────────────────────────────────────────────
      const recipientAddr = await evmRecipient.getAddress();
      const l1BalancePre = await evm.l1WarpToad.balanceOf(recipientAddr);

      await (await evm.l1WarpToad.connect(evmRelayer).mint(
        BigInt(proofInputs.nullifier),
        BigInt(proofInputs.amount),
        BigInt(proofInputs.giga_root),
        BigInt(proofInputs.destination_local_root),
        BigInt(proofInputs.fee_factor),
        BigInt(proofInputs.priority_fee),
        BigInt(proofInputs.max_fee),
        proofInputs.relayer_address,
        proofInputs.recipient_address,
        proof.proof,
        {
          maxPriorityFeePerGas: BigInt(proofInputs.priority_fee),
          maxFeePerGas: BigInt(proofInputs.priority_fee) * 100n,
        },
      )).wait();

      // ── Assert ────────────────────────────────────────────────
      const l1BalancePost = await evm.l1WarpToad.balanceOf(recipientAddr);
      const received = l1BalancePost - l1BalancePre;

      assert.ok(received > 0n, "Recipient should receive tokens on L1");
      assert.ok(
        received > commitment.amount - DEFAULT_FEE.maxFee,
        "Recipient should receive at least (amount - maxFee)",
      );
    });
  });
});
