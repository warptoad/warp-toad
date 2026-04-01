/**
 * L1 → L1 (same-chain) burn + mint test
 *
 * Tests the full flow on a single EVM chain:
 * 1. Wrap native tokens into L1WarpToad
 * 2. Burn with a commitment
 * 3. Generate a ZK proof
 * 4. Mint (withdraw) to a recipient with relayer fee
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import os from "os";

import {
  setupEvmOnlyEnvironment,
  createCommitment,
  getTestFeeFactor,
  DEFAULT_FEE,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
} from "./helpers";
import { createProof, getProofInputs } from "../lib/proving";
import { hashPreCommitment } from "../lib/hashing";

describe("L1 → L1 (same-chain)", () => {
  it("should burn and mint with a valid ZK proof", async () => {
    // ── Deploy ──────────────────────────────────────────────────
    const { evm, evmWallets, publicClient, chainId } = await setupEvmOnlyEnvironment();
    const [deployer, relayer, sender, recipient] = evmWallets;

    // ── Fund sender ─────────────────────────────────────────────
    // Mint native tokens, approve, and wrap into L1WarpToad
    await evm.nativeToken.write.getFreeShit([INITIAL_BALANCE], { account: sender.account });
    await evm.nativeToken.write.approve([evm.l1WarpToad.address, INITIAL_BALANCE], { account: sender.account });
    await evm.l1WarpToad.write.wrap([INITIAL_BALANCE], { account: sender.account });

    // ── Burn ────────────────────────────────────────────────────
    const commitment = createCommitment(
      TEST_COMMITMENT_1.amount,
      chainId,
      TEST_COMMITMENT_1.secret,
      TEST_COMMITMENT_1.nullifierPreimage,
    );

    await evm.l1WarpToad.write.burn([commitment.preCommitment, commitment.amount], { account: sender.account });

    const balanceAfterBurn = await evm.l1WarpToad.read.balanceOf([sender.account.address]);
    assert.equal(balanceAfterBurn, INITIAL_BALANCE - commitment.amount, "Balance should decrease by burn amount");

    // ── Generate proof ──────────────────────────────────────────
    const feeFactor = getTestFeeFactor(chainId);
    const proofInputs = await getProofInputs(
      evm.gigaBridge,
      evm.l1WarpToad, // destination
      evm.l1WarpToad, // origin (same chain)
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

    // ── Verify proof on-chain ───────────────────────────────────
    const withdrawVerifierAddr = await evm.l1WarpToad.read.withdrawVerifier();
    const withdrawVerifier = await hre.viem.getContractAt("WithdrawVerifier", withdrawVerifierAddr);
    const isValid = await withdrawVerifier.read.verify([proof.proof, proof.publicInputs]);
    assert.ok(isValid, "Proof should verify on-chain");

    // ── Mint (relayer submits) ──────────────────────────────────
    const balancePre = await evm.l1WarpToad.read.balanceOf([recipient.account.address]);

    await evm.l1WarpToad.write.mint(
      [
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
      ],
      {
        account: relayer.account,
        maxPriorityFeePerGas: BigInt(proofInputs.priority_fee),
        maxFeePerGas: BigInt(proofInputs.priority_fee) * 100n,
      },
    );

    // ── Assert ──────────────────────────────────────────────────
    const balancePost = await evm.l1WarpToad.read.balanceOf([recipient.account.address]);
    const received = balancePost - balancePre;

    // Recipient should receive amount minus relayer fee
    assert.ok(received > 0n, "Recipient should receive tokens");
    assert.ok(
      received > commitment.amount - DEFAULT_FEE.maxFee,
      "Recipient should receive at least (amount - maxFee)",
    );
  });
});
