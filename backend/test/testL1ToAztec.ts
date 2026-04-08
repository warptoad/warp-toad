/**
 * L1 -> Aztec burn + bridge + mint test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  setupFullEnvironment,
  createCommitment,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
} from "./helpers";
import { hashCommitment } from "../lib/hashing";
import { getMerkleData } from "../lib/proving";
import { bridgeBetweenL1AndL2 } from "../lib/bridging";

describe("L1 -> Aztec", () => {
  describe("deployment", () => {
    it("should deploy all contracts and wire them together", async () => {
      const { evm, aztec } = await setupFullEnvironment();

      const deployer = (await aztec.wallets[0].getAccounts())[0].item;
      const rawAddr = await aztec.warpToad.methods.get_l1_bridge_adapter().simulate({ from: deployer });
      const l1AdapterFromAztec = rawAddr.result.toString();
      assert.equal(
        l1AdapterFromAztec.toLowerCase(),
        evm.l1AztecBridgeAdapter!.address.toLowerCase(),
        "Aztec should know the correct L1 bridge adapter",
      );
    });
  });

  describe("burn on L1, mint on Aztec", () => {
    it("should burn on L1, bridge, and mint on Aztec via giga root", async () => {
      const { evm, aztec, evmWallets, chainId } = await setupFullEnvironment();
      const publicClient = evm.publicClient;

      const [evmDeployer, evmRelayer, evmSender] = evmWallets;
      const aztecDeployer = aztec.wallets[0];
      const aztecDeployerAddress = (await aztecDeployer.getAccounts())[0].item;

      const nodeInfo = await aztec.node.getNodeInfo();
      const { result: aztecChainIdRaw } = await aztec.warpToad.methods
        .get_chain_id_unconstrained(nodeInfo.rollupVersion)
        .simulate({ from: aztecDeployerAddress });
      const aztecChainId = BigInt(aztecChainIdRaw);

      // Fund sender on L1
      let hash = await evm.nativeToken.write.getFreeShit([INITIAL_BALANCE], { account: evmSender.account });
      await publicClient.waitForTransactionReceipt({ hash });
      hash = await evm.nativeToken.write.approve([evm.l1WarpToad.address, INITIAL_BALANCE], { account: evmSender.account });
      await publicClient.waitForTransactionReceipt({ hash });
      hash = await evm.l1WarpToad.write.wrap([INITIAL_BALANCE], { account: evmSender.account });
      await publicClient.waitForTransactionReceipt({ hash });

      // Burn on L1
      const commitment = createCommitment(
        TEST_COMMITMENT_1.amount,
        aztecChainId,
        TEST_COMMITMENT_1.secret,
        TEST_COMMITMENT_1.nullifierPreimage,
      );

      hash = await evm.l1WarpToad.write.burn([commitment.preCommitment, commitment.amount], { account: evmSender.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const balanceAfterBurn = await evm.l1WarpToad.read.balanceOf([evmSender.account.address]);
      assert.equal(balanceAfterBurn, INITIAL_BALANCE - commitment.amount, "L1 balance should decrease");

      // Bridge roots
      const localRootProviders = [evm.l1WarpToad.address, evm.l1AztecBridgeAdapter!.address];
      await bridgeBetweenL1AndL2(
        publicClient,
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

      const { result: aztecGigaRoot } = await aztec.warpToad.methods.get_giga_root().simulate({ from: aztecDeployerAddress });
      const l1GigaRoot = await evm.gigaBridge.read.gigaRoot();
      assert.equal(aztecGigaRoot.toString(), BigInt(l1GigaRoot).toString(), "Giga roots should match");

      // Mint on Aztec
      const { result: balancePre } = await aztec.warpToad.methods.balance_of(aztecDeployerAddress).simulate({ from: aztecDeployerAddress });

      const fullCommitment = hashCommitment(commitment.preCommitment, commitment.amount);
      const merkleData = await getMerkleData(
        evm.gigaBridge,
        publicClient,
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

      const { result: balancePost } = await aztec.warpToad.methods.balance_of(aztecDeployerAddress).simulate({ from: aztecDeployerAddress });
      assert.equal(
        balancePost,
        balancePre + BigInt(commitment.amount),
        "Aztec balance should increase by minted amount",
      );
    });
  });
});
