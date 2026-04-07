/**
 * L1 → Aztec burn + bridge + mint test
 *
 * Tests the cross-chain flow from Ethereum L1 to Aztec L2:
 * 1. Wrap + burn on L1 with commitment
 * 2. Bridge local root to GigaBridge, update giga root
 * 3. Send giga root to Aztec via L1-L2 messaging
 * 4. Mint on Aztec using merkle proof of commitment
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { ethers } from "ethers";

import {
  setupFullEnvironment,
  createCommitment,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
  TEST_COMMITMENT_2,
} from "./helpers";
import { hashCommitment } from "../lib/hashing";
import { getMerkleData } from "../lib/proving";
import { bridgeBetweenL1AndL2 } from "../lib/bridging";

describe("L1 → Aztec", () => {
  describe("deployment", () => {
    it("should deploy all contracts and wire them together", async () => {
      const { evm, aztec } = await setupFullEnvironment();

      // Verify Aztec WarpToad knows its L1 bridge adapter
      const deployer = (await aztec.wallets[0].getAccounts())[0].item;
      const rawAddr = await aztec.warpToad.methods.get_l1_bridge_adapter().simulate({ from: deployer });

      // EthAddress in Noir is struct { inner: Field }, extract and compare
      const l1AdapterFromAztec = ethers.getAddress(ethers.toBeHex(rawAddr.inner));
      assert.equal(
        l1AdapterFromAztec.toLowerCase(),
        evm.l1AztecBridgeAdapter.address.toLowerCase(),
        "Aztec should know the correct L1 bridge adapter",
      );
    });
  });

  describe("burn on L1, mint on Aztec", () => {
    it("should burn on L1, bridge, and mint on Aztec via giga root", async () => {
      const { evm, aztec, evmWallets, chainId } = await setupFullEnvironment();

      const [evmDeployer, evmRelayer, evmSender] = evmWallets;
      const aztecDeployer = aztec.wallets[0];
      const aztecDeployerAddress = (await aztecDeployer.getAccounts())[0].item;

      // ── Get Aztec chain ID ────────────────────────────────────
      const nodeInfo = await aztec.node.getNodeInfo();
      const aztecChainId = BigInt(
        await aztec.warpToad.methods
          .get_chain_id_unconstrained(nodeInfo.rollupVersion)
          .simulate({ from: aztecDeployerAddress }),
      );

      // ── Fund sender on L1 ─────────────────────────────────────
      await evm.nativeToken.write.getFreeShit([INITIAL_BALANCE], { account: evmSender.account });
      await evm.nativeToken.write.approve([evm.l1WarpToad.address, INITIAL_BALANCE], { account: evmSender.account });
      await evm.l1WarpToad.write.wrap([INITIAL_BALANCE], { account: evmSender.account });

      // ── Burn on L1 ────────────────────────────────────────────
      const commitment = createCommitment(
        TEST_COMMITMENT_1.amount,
        aztecChainId,
        TEST_COMMITMENT_1.secret,
        TEST_COMMITMENT_1.nullifierPreimage,
      );

      await evm.l1WarpToad.write.burn([commitment.preCommitment, commitment.amount], { account: evmSender.account });

      const balanceAfterBurn = await evm.l1WarpToad.read.balanceOf([evmSender.account.address]);
      assert.equal(balanceAfterBurn, INITIAL_BALANCE - commitment.amount, "L1 balance should decrease");

      // ── Bridge roots ──────────────────────────────────────────
      const localRootProviders = [evm.l1WarpToad.address, evm.l1AztecBridgeAdapter.address];
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

      // Verify giga root arrived on Aztec
      const aztecGigaRoot = await aztec.warpToad.methods.get_giga_root().simulate({ from: aztecDeployerAddress });
      const l1GigaRoot = await evm.gigaBridge.read.gigaRoot();
      assert.equal(aztecGigaRoot.toString(), BigInt(l1GigaRoot.toString()).toString(), "Giga roots should match");

      // ── Mint on Aztec ─────────────────────────────────────────
      const balancePre = await aztec.warpToad.methods.balance_of(aztecDeployerAddress).simulate({ from: aztecDeployerAddress });

      const fullCommitment = hashCommitment(commitment.preCommitment, commitment.amount);
      const merkleData = await getMerkleData(
        evm.gigaBridge,
        evm.l1WarpToad,
        aztec.warpToad,
        fullCommitment,
        aztecDeployer,
        aztec.pxe,
        aztec.node,
      );

      await aztec.warpToad.methods
        .mint_giga_root_evm(
          commitment.amount,
          commitment.secret,
          commitment.nullifierPreimage,
          aztecDeployerAddress,
          merkleData.blockNumber,
          merkleData.originLocalRoot,
          merkleData.gigaMerkleData as any,
          merkleData.evmMerkleData as any,
        )
        .send({ from: aztecDeployerAddress });

      const balancePost = await aztec.warpToad.methods.balance_of(aztecDeployerAddress).simulate({ from: aztecDeployerAddress });
      assert.equal(
        balancePost,
        balancePre + BigInt(commitment.amount),
        "Aztec balance should increase by minted amount",
      );
    });
  });
});
