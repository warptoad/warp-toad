/**
 * L1 -> L1 (same-chain) burn + mint test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import os from "os";
import { bytesToHex } from "viem";

import {
  setupEvmOnlyEnvironment,
  createCommitment,
  getTestFeeFactor,
  DEFAULT_FEE,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
} from "./helpers/index.js";
import { createProof, getProofInputs } from "../lib/proving.js";

describe("L1 -> L1 (same-chain)", () => {
  it("should burn and mint with a valid ZK proof", async () => {
    const { evm } = await setupEvmOnlyEnvironment();
    const [deployer, relayer, sender, recipient] = evm.wallets;
    const publicClient = evm.publicClient;

    // Fund sender
    let hash = await evm.nativeToken.write.getFreeShit([INITIAL_BALANCE], { account: sender.account });
    await publicClient.waitForTransactionReceipt({ hash });
    hash = await evm.nativeToken.write.approve([evm.l1WarpToad.address, INITIAL_BALANCE], { account: sender.account });
    await publicClient.waitForTransactionReceipt({ hash });
    hash = await evm.l1WarpToad.write.wrap([INITIAL_BALANCE], { account: sender.account });
    await publicClient.waitForTransactionReceipt({ hash });

    // Burn
    const chainId = BigInt(await publicClient.getChainId());
    const commitment = createCommitment(
      TEST_COMMITMENT_1.amount,
      chainId,
      TEST_COMMITMENT_1.secret,
      TEST_COMMITMENT_1.nullifierPreimage,
    );

    hash = await evm.l1WarpToad.write.burn([commitment.preCommitment, commitment.amount], { account: sender.account });
    await publicClient.waitForTransactionReceipt({ hash });

    const balanceAfterBurn = await evm.l1WarpToad.read.balanceOf([sender.account.address]);
    assert.equal(balanceAfterBurn, INITIAL_BALANCE - commitment.amount, "Balance should decrease by burn amount");

    const localRoot = await evm.l1WarpToad.read.cachedLocalRoot();
    console.log("localRoot:", localRoot.toString());
    console.log("localRoot stored?", await evm.l1WarpToad.read.localRootHistory([localRoot]));

    // Generate proof
    const feeFactor = getTestFeeFactor();
    console.log("Current block number:", await publicClient.getBlockNumber());

    const proofInputs = await getProofInputs(
      evm.gigaBridge,
      publicClient,
      evm.l1WarpToad,
      evm.l1WarpToad,
      commitment.amount,
      feeFactor,
      DEFAULT_FEE.priorityFee,
      DEFAULT_FEE.maxFee,
      relayer.account.address,
      recipient.account.address,
      commitment.nullifierPreimage,
      commitment.secret,
    );

    const proof = await createProof(proofInputs, os.cpus().length);

    // Verify proof on-chain
    const isValid = await evm.withdrawVerifier.read.verify([bytesToHex(proof.proof), proof.publicInputs]);
    assert.ok(isValid, "Proof should verify on-chain");

    // Mint
    const balancePre = await evm.l1WarpToad.read.balanceOf([recipient.account.address]);

    try {
    hash = await evm.l1WarpToad.write.mint([
      BigInt(proofInputs.nullifier),
      BigInt(proofInputs.amount),
      BigInt(proofInputs.giga_root),
      BigInt(proofInputs.destination_local_root),
      BigInt(proofInputs.fee_factor),
      BigInt(proofInputs.priority_fee),
      BigInt(proofInputs.max_fee),
      proofInputs.relayer_address,
      proofInputs.recipient_address,
      bytesToHex(proof.proof),
    ], {
      account: relayer.account,
      maxPriorityFeePerGas: BigInt(proofInputs.priority_fee),
      maxFeePerGas: BigInt(proofInputs.priority_fee) * 100n,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    } catch (e: any) { console.error("MINT FAILED:", e?.shortMessage ?? e?.message ?? e); throw e; }

    const balancePost = await evm.l1WarpToad.read.balanceOf([recipient.account.address]);
    const received = balancePost - balancePre;

    assert.ok(received > 0n, "Recipient should receive tokens");
    assert.ok(
      received > commitment.amount - DEFAULT_FEE.maxFee,
      "Recipient should receive at least (amount - maxFee)",
    );
  });
});
