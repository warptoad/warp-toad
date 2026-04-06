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
import { ethers } from "ethers";
import os from "os";

import {
  setupEvmOnlyEnvironment,
  createCommitment,
  getTestFeeFactor,
  toEthersContract,
  DEFAULT_FEE,
  INITIAL_BALANCE,
  TEST_COMMITMENT_1,
} from "./helpers/index.js";
import { createProof, getProofInputs } from "../lib/proving.js";

describe("L1 → L1 (same-chain)", () => {
  it("should burn and mint with a valid ZK proof", async () => {
    // ── Deploy ──────────────────────────────────────────────────
    const { evm } = await setupEvmOnlyEnvironment();
    const [deployer, relayer, sender, recipient] = evm.signers;

    // Connect contracts with different signers
    const nativeTokenAsSender = evm.nativeToken.connect(sender);
    const l1WarpToadAsSender = evm.l1WarpToad.connect(sender);
    const l1WarpToadAsRelayer = evm.l1WarpToad.connect(relayer);

    // ── Fund sender ─────────────────────────────────────────────
    await (await nativeTokenAsSender.getFreeShit(INITIAL_BALANCE)).wait();
    await (await nativeTokenAsSender.approve(await evm.l1WarpToad.getAddress(), INITIAL_BALANCE)).wait();
    await (await l1WarpToadAsSender.wrap(INITIAL_BALANCE)).wait();

    // ── Burn ────────────────────────────────────────────────────
    const chainId = (await evm.provider.getNetwork()).chainId;
    const commitment = createCommitment(
      TEST_COMMITMENT_1.amount,
      chainId,
      TEST_COMMITMENT_1.secret,
      TEST_COMMITMENT_1.nullifierPreimage,
    );

    await (await l1WarpToadAsSender.burn(commitment.preCommitment, commitment.amount)).wait();

    const balanceAfterBurn = await evm.l1WarpToad.balanceOf(await sender.getAddress());
    assert.equal(balanceAfterBurn, INITIAL_BALANCE - commitment.amount, "Balance should decrease by burn amount");

    // Debug: verify local root state
    const localRoot = await evm.l1WarpToad.cachedLocalRoot();
    console.log("localRoot:", localRoot.toString());
    console.log("localRoot stored?", await evm.l1WarpToad.localRootHistory(localRoot));

    // ── Generate proof ──────────────────────────────────────────
    const feeFactor = getTestFeeFactor();
    // Debug: block number
    const bn = await evm.provider.getBlockNumber();
    console.log("Current block number:", bn);

    // Debug: check events directly
    const burnFilter = evm.l1WarpToad.filters.Burn();
    const events = await evm.l1WarpToad.queryFilter(burnFilter, 0, "latest");
    console.log("Burn events found:", events.length);
    for (const e of events) {
      console.log("  block:", e.blockNumber, "topics:", e.topics);
    }

    // Pass the SAME contract reference for origin & destination so getMerkleData
    // detects same-chain mode (isOnlyLocal = origin === destination)
    const proofInputs = await getProofInputs(
      evm.gigaBridge as any,
      evm.l1WarpToad as any,
      evm.l1WarpToad as any,
      commitment.amount,
      feeFactor,
      DEFAULT_FEE.priorityFee,
      DEFAULT_FEE.maxFee,
      await relayer.getAddress(),
      await recipient.getAddress(),
      commitment.nullifierPreimage,
      commitment.secret,
    );

    const proof = await createProof(proofInputs, os.cpus().length);

    // ── Verify proof on-chain ───────────────────────────────────
    const withdrawVerifierAddr = await evm.l1WarpToad.withdrawVerifier();
    const withdrawVerifier = evm.withdrawVerifier.attach(withdrawVerifierAddr);
    const isValid = await withdrawVerifier.verify(proof.proof, proof.publicInputs);
    assert.ok(isValid, "Proof should verify on-chain");

    // ── Mint (relayer submits) ──────────────────────────────────
    const recipientAddr = await recipient.getAddress();
    const balancePre = await evm.l1WarpToad.balanceOf(recipientAddr);

    await (await l1WarpToadAsRelayer.mint(
      ethers.toBigInt(proofInputs.nullifier),
      ethers.toBigInt(proofInputs.amount),
      ethers.toBigInt(proofInputs.giga_root),
      ethers.toBigInt(proofInputs.destination_local_root),
      ethers.toBigInt(proofInputs.fee_factor),
      ethers.toBigInt(proofInputs.priority_fee),
      ethers.toBigInt(proofInputs.max_fee),
      ethers.getAddress(proofInputs.relayer_address.toString()),
      ethers.getAddress(proofInputs.recipient_address.toString()),
      ethers.hexlify(proof.proof),
      {
        maxPriorityFeePerGas: ethers.toBigInt(proofInputs.priority_fee),
        maxFeePerGas: ethers.toBigInt(proofInputs.priority_fee) * 100n,
      },
    )).wait();

    // ── Assert ──────────────────────────────────────────────────
    const balancePost = await evm.l1WarpToad.balanceOf(recipientAddr);
    const received = balancePost - balancePre;

    assert.ok(received > 0n, "Recipient should receive tokens");
    assert.ok(
      received > commitment.amount - DEFAULT_FEE.maxFee,
      "Recipient should receive at least (amount - maxFee)",
    );
  });
});
