import type { Chain } from "viem";
import { zksyncSepoliaTestnet } from "viem/chains";

import {
    ZKSYNC_ERA_CHAINID_SEPOLIA,
    ZK_STACK_ADAPTER_SLOTS,
    ZK_STACK_CHAINS,
} from "./constants.js";

/**
 * Registry of the ZK Stack L2s this deployment actually targets.
 *
 * `slot` is the GigaBridge recipient index and the L1ZkStackBridgeAdapter instance that
 * chain claims. It is permanent: GigaBridge fixes its recipient set in its constructor,
 * so slots cannot be added later without redeploying the whole L1 stack. There are
 * ZK_STACK_ADAPTER_SLOTS of them and anything not listed here is an unclaimed spare.
 *
 * To adopt another ZK Stack chain on the same Bridgehub:
 *   1. append it to ZK_STACK_CHAINS in constants.ts (claiming the next free slot)
 *   2. append it here with its viem chain, RPC env var and hardhat network name
 *   3. add the network + chainDescriptor to hardhat.config.ts
 *   4. re-run the deploy; every earlier phase is idempotent, so only the new chain
 *      deploys and only the new slot gets initialized
 */
export interface ZkStackTarget {
    slot: number;
    label: string;
    chainId: number;
    viemChain: Chain;
    /** env var holding this chain's RPC URL */
    rpcEnv: string;
    /** network key in hardhat.config.ts */
    hardhatNetwork: string;
    /**
     * Generous upper bound on how long an L2->L1 root push takes to become provable,
     * i.e. batch seal + commit + prove + execute on L1.
     *
     * These differ by an order of magnitude between ZK Stack chains, because a
     * low-traffic chain seals batches on a timeout rather than on fullness. A single
     * shared constant is therefore wrong: it either stalls a slow chain or makes a
     * fast one look hung. Used for bridge timeouts and for deciding which legs to
     * isolate into their own sync cycle.
     */
    l2ToL1TimeoutMs: number;
}

export const ZK_STACK_TARGETS: ZkStackTarget[] = [
    {
        slot: 0,
        label: "zkSync Era Sepolia",
        chainId: Number(ZKSYNC_ERA_CHAINID_SEPOLIA),
        viemChain: zksyncSepoliaTestnet,
        rpcEnv: "ZKSYNC_ERA_SEPOLIA_RPC_URL",
        hardhatNetwork: "zksyncEraSepolia",
        // Measured 2026-07-20: 116 min end to end (2h batch window + ~30 min to
        // commit/prove/execute). 3h leaves headroom.
        l2ToL1TimeoutMs: 3 * 60 * 60 * 1000,
    },
];

/**
 * Fail loudly if the two lists disagree. A mismatch would otherwise surface as an L2
 * deployed against an L1 slot that never gets initialized, which only shows up hours
 * later when a root fails to land.
 */
export function assertZkStackRegistryConsistent(): void {
    for (const { slot, chainId } of ZK_STACK_CHAINS) {
        const target = ZK_STACK_TARGETS.find((t) => t.slot === slot);
        if (!target) {
            throw new Error(`ZK_STACK_CHAINS slot ${slot} has no matching ZK_STACK_TARGETS entry`);
        }
        if (BigInt(target.chainId) !== BigInt(chainId)) {
            throw new Error(
                `slot ${slot} chainId mismatch: constants say ${chainId}, target says ${target.chainId}`,
            );
        }
    }
    for (const t of ZK_STACK_TARGETS) {
        if (t.slot < 0 || t.slot >= ZK_STACK_ADAPTER_SLOTS) {
            throw new Error(
                `ZK_STACK_TARGETS entry ${t.label} uses slot ${t.slot}, outside the ${ZK_STACK_ADAPTER_SLOTS} deployed slots`,
            );
        }
        if (!ZK_STACK_CHAINS.some((c) => c.slot === t.slot)) {
            throw new Error(`ZK_STACK_TARGETS entry ${t.label} claims slot ${t.slot}, which ZK_STACK_CHAINS does not`);
        }
    }
}

/** Slot indexes deployed but not claimed by any chain. These are uninitialized and
 *  REVERT on getLocalRootAndBlock(), so they must never be passed to updateGigaRoot. */
export function unclaimedZkStackSlots(): number[] {
    const claimed = new Set(ZK_STACK_CHAINS.map((c) => c.slot));
    return Array.from({ length: ZK_STACK_ADAPTER_SLOTS }, (_, i) => i).filter((i) => !claimed.has(i));
}
