# Unified Bridge-Sync Scheduler + Frontend Operation Persistence

Plan for replacing the per-route triggering and aztec-only heartbeat in
`bridge-sync` with a single coalescing scheduler that converges all chains,
runs only stale legs, and bounds any single user's wait to one Scroll
finalization (~1-3h floor) instead of two stacked cycles (~4+h).

## Goal

A user who burns on Scroll and tries to withdraw on Aztec currently hits
`BridgeSyncStaleError`, which queues a 2-4h sync at withdraw time. Worst case
the user is "trapped in tick #2" (their burn landed after the in-flight
cycle's `sendL2ToL1` already fired) and they wait 4+h.

We want:

1. Server-side: replace per-route triggering and `aztecHeartbeat` with a
   unified coalescing scheduler that always converges all chains, runs only
   stale legs, and never queues redundant cycles.
2. Frontend: persist `operationId` keyed by commitment hash and show a
   real "in progress, ETA HH:MM" state on the withdraw page instead of
   surfacing the stale-root error.

## Section 1: Verification (vs current source)

Confirmed in source:

- POST `/bridge/:from/:to` lives at `bridge-sync/src/server.ts:212-267`. Mints
  `operationId` via `randomUUID()`, calls `routeToRequirements(from, to)`,
  fires `requestSync(EVM_PRIVATE_KEY, confirmations, requirements)`. The
  `operations` Map is in-memory only.
- `routeToRequirements` lives at `bridge-sync/src/bridge/syncRequirements.ts:53-60`,
  is unconditional (route to flag set, no on-chain check).
- `syncOrchestrator.ts:38-53` already coalesces concurrent waiters via
  `unionOf` (`:59-64`); `cycleLoop` folds `pending` into `inflight` between
  retries (`:79-83`). No coalescing across cycle boundaries: after
  `cycleLoopRunning = false`, the next request starts a fresh cycle.
- `aztecHeartbeat.ts:108-222` interval defaults to 5 min via
  `AZTEC_HEARTBEAT_CHECK_INTERVAL_MS`; threshold default 80 blocks via
  `AZTEC_HEARTBEAT_THRESHOLD_BLOCKS`. Re-entrancy guarded by local `running`.
- `executor.ts:404` always dispatches gigaRoot to all three recipients
  (`l1WarpToadAddress, aztecAdapter, scrollAdapter`) regardless of which
  flags fired the cycle. The comment at `:386-403` explains why this is
  load-bearing; do not change.
- `aztecPending.ts` and `scrollPending.ts` persist L2-to-L1 leg state via
  `BRIDGE_SYNC_DB_DIR` (default `./db`), 24 h TTL, with resume in
  `executor.ts:268-289` (Aztec) and `:326-344` (Scroll).
- `BridgeSyncStaleError` throw sites: `frontend/src/lib/utils/scroll-interactions.ts:669`
  (Scroll commitment not in L1-anchored Scroll tree) and
  `frontend/src/lib/utils/aztec-interactions.ts:613` (no gigaRoot containing
  commitment found on Aztec side). These two predicates are exactly what the
  staleness algorithm needs to mirror.

Notable corrections vs the prompt:

- The prompt assumed waiters mid-cycle resolve at end of current tick. Today
  they get pushed into `pending` and resolved by the next attempt/cycle.
  The new design's "resolve current waiters at end of current tick + start
  follow-up tick" is a deliberate behavior change.
- `BridgeOperation.status` already includes `'running'` and `'timeout'`
  (`types/index.ts:2`). Server only writes `'pending'`, `'completed'`,
  `'failed'` today. Free states to use without type changes.
- `gigaState.ts` already has the read pattern needed for `computeStaleLegs`:
  Promise.all over `gigaBridge.gigaRoot()`, `getLocalRootProvidersIndex`,
  `getLocalRootAndBlock()`. Reuse, do not reinvent.
- `frontend/src/lib/components/BridgeForm.svelte:299-305` writes a single
  global localStorage slot via `savePendingBridgeSync`. Latest call
  clobbers any previous in-flight op. The new design needs per-commitment
  keying.
- `Proof` type has no `bridgeSync` field today; extending it is the natural
  place for per-proof persistence. Existing `bigIntReplacer/bigIntReviver` in
  `proofs.svelte.ts:39-53` handles new fields automatically.
- bridge-sync has no test directory; verification is e2e + log inspection
  + the existing `pnpm b:test` (which exercises `lib/bridging.ts` through
  `backend/test/`).

## Section 2: File-level changes

### bridge-sync server

**`bridge-sync/src/server.ts` (modify)**
- POST `/bridge/:fromChainId/:toChainId`: stop calling
  `routeToRequirements`; call `scheduler.enqueueOperation(opId, { from, to })`
  instead. Route validation stays for input sanity and `expectedDuration`.
- `app.listen` callback: replace `startAztecHeartbeat(...)` with
  `scheduler.start({ idleIntervalMs: AZTEC_HEARTBEAT_CHECK_INTERVAL_MS })`.
  Forward existing `AZTEC_HEARTBEAT_*` env vars as scheduler tunables; do
  not introduce new env keys.
- `/health`: emit `scheduler: scheduler.getState()` (replaces `orchestrator`
  and `heartbeat` blocks). Keep both old keys populated as aliases for one
  release for backward compat.
- Persist `operations` Map via `operationsStore.ts` (load on boot; save on
  every status mutation).

**`bridge-sync/src/bridge/staleLegs.ts` (new)**
- Pure read-only function returning `SyncRequirements`. Single source of
  truth for "is anything actually out of date right now?"
- Exports:
  - `interface StaleLegInputs { l1ChainId: bigint; aztecBlockLagThreshold: number; ... }`
  - `async function computeStaleLegs(inputs: StaleLegInputs): Promise<StaleLegsReport>`
  - `async function isStale(inputs: StaleLegInputs): Promise<boolean>`
  - `function buildStaleLegInputs(): StaleLegInputs` (reads env)

**`bridge-sync/src/bridge/unifiedScheduler.ts` (new)**
- Coalescing single-slot ticker.
- Exports:
  - `interface ScheduleConfig { privateKey: string; confirmations: number; idleIntervalMs: number; coalesceWindowMs?: number; }`
  - `interface SchedulerState { running: boolean; scheduledTickAt: number | null; followUpScheduled: boolean; waiters: number; lastTickAt: number | null; lastTickResult: 'noop' | 'success' | 'failed' | null; lastStaleLegs: SyncRequirements | null; }`
  - `function startScheduler(config: ScheduleConfig): void` (idempotent)
  - `function enqueueOperation(opId: string, route: { from: ChainId; to: ChainId }): Promise<FullSyncResult>`
  - `function getSchedulerState(): SchedulerState`
  - `function stopScheduler(): void`
- Internals:
  - On first POST after idle: schedule tick at `now + coalesceWindowMs`
    (default 90 s).
  - Subsequent POSTs within the window: just push waiter, no timer reset.
  - On POST during in-flight tick: push waiter, set `followUpScheduled = true`.
  - On idle interval tick: if not running and not scheduled and
    `isStale()`, run tick now.
  - `tick()`: lock running, call `computeStaleLegs`, run only flagged legs
    via `runSyncCycle`, resolve all waiters with the result, check
    `followUpScheduled || isStale()` and reschedule next tick if so.
  - Existing `runSyncCycle` retry-twice semantics moved into `tick()`.

**`bridge-sync/src/bridge/operationsStore.ts` (new)**
- Persists `operations` Map across restarts. Mirrors `aztecPending.ts` /
  `scrollPending.ts` disk pattern. JSON file at
  `${BRIDGE_SYNC_DB_DIR}/operations.json`. 48 h TTL.
- Exports: `loadAll()`, `saveOperation(op)` (debounced, max 1 write/sec),
  `deleteExpired(maxAgeMs)`.

**`bridge-sync/src/bridge/syncOrchestrator.ts` (modify, then delete in step 7)**
- Once scheduler is wired, `requestSync` and `cycleLoop` become dead code.
- Keep file un-imported during steps 5-6 so a hotfix can revert by flipping
  one import line.
- Delete only after one production cycle proves the scheduler stable.

**`bridge-sync/src/bridge/aztecHeartbeat.ts` (delete after step 6)**
- Subsumed by the scheduler's `idleIntervalMs` and the
  `aztecBlockLag > threshold` arm of `computeStaleLegs`.
- Keep `getHeartbeatState()` exported as a thin shim mapping
  `getSchedulerState()` to the old `HeartbeatState` shape during the
  transition window so `/health.heartbeat.lastLag` consumers keep working.
  Delete shim after one release.

**`bridge-sync/src/bridge/syncRequirements.ts` (modify minimally)**
- Keep `SyncRequirements`, `EMPTY_REQUIREMENTS`, `mergeRequirements`,
  `hasAnyRequirement` (still used by executor and the new scheduler).
- Delete `routeToRequirements` once unreferenced.

**`bridge-sync/src/bridge/executor.ts` (no signature changes)**
- `runSyncCycle` continues to take `(privateKey, confirmations, requirements)`.
- Preserve always-dispatch-to-3 behavior at `:404`.
- Preserve per-flag receive gating in step 5.

### frontend

**`frontend/src/lib/types/bridge.ts` (modify)**
- Extend `Proof` with optional `bridgeSync` field:
  ```
  bridgeSync?: {
    operationId: string;
    fromChainId: string;
    toChainId: string;
    startedAtMs: number;
    expectedDuration: string;
    lastStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'noop';
    lastPolledAtMs?: number;
    lastError?: string;
    txHashes?: Record<string, string>;
  } | null;
  ```

**`frontend/src/lib/stores/proofs.svelte.ts` (modify)**
- `attachBridgeSync(proofId, sync)`: set and persist.
- `updateBridgeSyncStatus(proofId, partial)`: merge and persist.
- `clearBridgeSync(proofId)`: set to null on successful withdraw.
- `findProofByCommitment(commitment)`: helper for catch path.
- Modify `addProof` to accept an optional `bridgeSync` arg.

**`frontend/src/lib/utils/bridge-keeper.ts` (modify)**
- Add `'noop'` to `BridgeStatusResponse.status` union.
- Mark `savePendingBridgeSync` / `getPendingBridgeSync` /
  `clearPendingBridgeSync` deprecated (do not delete in this PR).
- New `pollOperation(operationId, signal?)`: retry-on-error wrapper around
  `checkBridgeStatus` for the WithdrawForm in-progress panel.

**`frontend/src/lib/components/BridgeForm.svelte` (modify)**
- `triggerRootSync()` (line 277): after `triggerBridge()` returns, attach the
  `operationId` to the just-created proof via
  `proofStore.attachBridgeSync(proof.id, { ... })`.
- Replace `savePendingBridgeSync(...)` with the per-proof attach.

**`frontend/src/lib/components/WithdrawForm.svelte` (modify)**
- `onMount`: if `selectedProof?.bridgeSync != null && !selectedProof.used`,
  start a poll loop (every 30 s) calling `pollOperation` and
  `updateBridgeSyncStatus`. Cancel via `AbortController` on unmount and proof
  change.
- `BridgeSyncStaleError` catch (line 526-551): also write the new opId into
  the proof record so a later visit sees progress.
- Add a derived `bridgeSyncProgress` panel: when bridgeSync is set and not
  completed, show "Bridge sync in progress. ETA HH:MM (started X minutes
  ago)". Hide once `lastStatus` is `completed` or `noop`.
- All UI strings use lowercase "warptoad". No em dashes.

## Section 3: computeStaleLegs algorithm

Single Promise.all of contract reads, then deterministic flag derivation.
Reuse `loadL1Contracts` / `loadL1AdapterByType` / `loadScrollContracts` from
`contractLoader.ts` and the per-leaf reads pattern from `gigaState.ts`.

```
computeStaleLegs({ l1ChainId, aztecBlockLagThreshold }):
  l1Public = createPublicClient(getChainConfig(l1ChainIdStr).rpcUrl)
  L1 = loadL1Contracts(l1ChainId, l1Public, dummyWallet, true)
  aztecAdapter = loadL1AdapterByType(l1ChainId, l1Public, dummyWallet, 'aztec')
  scrollAdapter = loadL1AdapterByType(l1ChainId, l1Public, dummyWallet, 'scroll')

  scrollPublic = SCROLL_RPC_URL ? createPublicClient(SCROLL_RPC_URL) : null
  scroll = scrollPublic ? loadScrollContracts(534351n, scrollPublic, dummyWallet) : null
  aztecNode = AZTEC_NODE_URL ? createAztecNodeClient(AZTEC_NODE_URL) : null

  reads = await Promise.all([
    L1.gigaBridge.read.gigaRoot(),                                      // currentGigaRoot
    aztecAdapter.adapter.read.getLocalRootAndBlock(),                   // (aztecLocalRootOnL1, aztecBlockOnL1)
    scrollAdapter.adapter.read.getLocalRootAndBlock(),                  // (scrollLocalRootOnL1, scrollBlockOnL1)
    aztecAdapter.adapter.read.mostRecentL2RootBlockNumber(),            // for lag check
    scrollPublic ? scroll.L2WarpToad.read.localRoot() : null,           // currentScrollLocalRoot (HEAD)
    scrollPublic ? scroll.L2WarpToad.read.gigaRoot() : null,            // gigaRoot stored on Scroll L2
    scrollPublic ? scroll.L2WarpToad.read.gigaRootProvider() : null,    // 0x0 = deploy bug guard
    aztecNode ? aztecNode.getBlockNumber() : null,                      // aztecHead for lag
  ])

  // Deploy-bug guard: if Scroll L2WarpToad.gigaRootProvider == 0x0, all
  // Scroll relays silently FailedRelayedMessages. Don't burn gas on a
  // doomed cycle. Memory: feedback_l2warptoad_initialize_required.md.
  if scroll && reads[6] === 0x0:
    log.error('[stale-legs] L2WarpToad.gigaRootProvider is 0x0; deploy bug, not a sync issue')
    return { flags: EMPTY_REQUIREMENTS, detail: { ... } }

  flags = { ...EMPTY_REQUIREMENTS }

  // Aztec L2-to-L1 staleness: TWO triggers, OR'd together.
  // Trigger A: aztec head lags too far behind L1-anchored block (node-pruning workaround).
  // Trigger B: live aztec localRoot differs from L1-anchored localRoot.
  // Memory: feedback_aztec_node_prunes_state.md - this lag-based push
  // is what keeps node_getNoteHashMembershipWitness working at withdraw time.
  if aztecNode:
    aztecLag = reads[7] - Number(reads[3])
    if reads[3] === 0n || aztecLag > aztecBlockLagThreshold:
      flags.needAztecL2ToL1 = true   // node-pruning protection: do not skip even if roots match

  // Scroll L2-to-L1 staleness: live localRoot vs L1-anchored leaf.
  if scroll:
    scrollLocalRoot = reads[4]
    scrollLeafOnL1 = reads[2][0]
    if scrollLocalRoot !== scrollLeafOnL1:
      flags.needScrollL2ToL1 = true

  // Dispatch staleness:
  // (a) If we already need an L2-to-L1 leg, the gigaRoot will change, so
  //     dispatch to all L2s. Step 4 always dispatches to all 3 recipients
  //     anyway (executor.ts:404), so set both flags so step 5 receives.
  if flags.needAztecL2ToL1 || flags.needScrollL2ToL1:
    flags.dispatchToAztec = true
    flags.dispatchToScroll = true

  // (b) Standalone Scroll dispatch: L2 mirror of gigaRoot is stale even
  //     though no L2-to-L1 leg is needed.
  if scroll && reads[5] !== reads[0]:
    flags.dispatchToScroll = true

  // (c) Standalone Aztec dispatch: skipped here. Aztec L2 gigaRoot read
  //     would require PXE/aztec-node and is heavyweight on this hot path.
  //     Relying on the lag-threshold push above to catch all aztec staleness.

  return { flags, detail: { ... observability ... } }
```

Notes:

- All contract reads are storage-only. No `getLogs`. The viem indexed-arg
  filter footgun (memory: `feedback_viem_indexed_array_filter.md`) does not
  apply.
- The lag-threshold branch is load-bearing per
  `feedback_aztec_node_prunes_state.md`. Keep the comment in code and do
  not skip even when local roots match.
- Aztec node read failures return `null`; we fall through with conservative
  flags (no throw). Next tick retries.
- `dummyWallet` is `{} as any` per `gigaState.ts:75-77` precedent.
- `SCROLL_RPC_URL` unset: skip Scroll branch entirely. Matches today's
  `aztecHeartbeat.ts:140-143` convention.

## Section 4: Migration / rollout order

Each step shippable independently.

1. Add `staleLegs.ts` plus a debug endpoint
   `GET /debug/stale-legs` returning the live report. Pure read; no
   behavior change for users. Deploy and observe.
2. Add `operationsStore.ts`. Wire `operations` Map through it. Verify
   restart preserves opIds visible via `/status/:operationId`.
3. Add `unifiedScheduler.ts` but do not wire it. Refactor-only commit.
4. Wire scheduler behind feature flag
   `BRIDGE_SYNC_USE_UNIFIED_SCHEDULER=false` default. When true: POST
   handler calls `scheduler.enqueueOperation`, listen wires
   `scheduler.start()`. Else: existing behavior. Last fully-revertible
   step.
5. Point of no return: enable scheduler in production. Watch for one full
   Scroll-finalization window (3 h). Roll back by flipping the flag.
6. Frontend changes (independent of backend cutover; backward
   compatible). Order: types, then proofs.svelte.ts, then
   bridge-keeper.ts, then BridgeForm, then WithdrawForm.
7. Delete dead code after one week of clean operation: `aztecHeartbeat.ts`,
   `routeToRequirements`, `syncOrchestrator.ts`, the feature flag,
   legacy `savePendingBridgeSync` helpers.

## Section 5: Test plan

bridge-sync has no unit-test harness. Verification is e2e + log
inspection + the existing `pnpm b:test` against `backend/test/`.

1. Aztec node-pruning protection preserved: `/health.scheduler.lastStaleLegs.needAztecL2ToL1=true`
   whenever lag > threshold even when roots match. Verify
   `mostRecentL2RootBlockNumber` stays within ~100 of `aztecHead` over 24
   h.
2. Coalescing: two POSTs to `/bridge/534351/aztec` within 10 s produce
   exactly one `[scheduler] running tick (waiters=2)` log entry; only one
   set of step 3 / step 4 L1 txs in the explorer.
3. Follow-up: POST during in-flight cycle sets `followUpScheduled=true`.
   After cycle ends, exactly one tick B fires.
4. No-op cycle: POST when nothing stale produces `{ status: 'noop' }`.
   L1 wallet nonce does not increment.
5. Scroll burn at T=10s no longer hits BridgeSyncStaleError on withdraw:
   in-progress panel renders with ETA; user can leave + return + still
   see progress.
6. Restart resilience: in-flight Scroll leg + container restart;
   `operations.json` reload restores opIds, `loadScrollPending` triggers
   resume.
7. L2WarpToad deploy-bug guard: `gigaRootProvider == 0x0` produces a
   loud error log and `EMPTY_REQUIREMENTS`; no cycle spin.
8. Existing backend tests still pass: `pnpm b:test` (`testL1ToL1.ts`,
   `testL1ToAztec.ts`, `testAztecToL1.ts`).

## Section 6: Risks and edge cases

- Race between absorption-window timer and idle interval: guard with the
  existing `running` boolean (mirrors `aztecHeartbeat.ts:151-152`). When
  running, both paths just set `followUpScheduled = true`.
- Race between enqueue and end-of-tick cleanup: do everything inside the
  same synchronous block at the end of `tick()`'s `finally`.
- Coalesce window UX latency: 90 s before first tick fires after idle. Could
  fire instantly on first enqueue when no other waiters exist. Decide and
  document in code.
- Backward compat for old opIds: 48 h TTL on
  `operationsStore`. Frontend treats 404 from `/status/:opId` as
  "operation expired, drop bridgeSync field locally."
- `'noop'` status not in old union: extend in `bridge-keeper.ts`. Older
  tabs holding stale JS will log "unknown status: noop" and treat it as
  non-completed; reload picks up the new union.
- Aztec node temporary outage: `computeStaleLegs` returns null reads, falls
  through with conservative flags, never throws.
- Persistence file corruption: `loadAll` catches, logs, starts with empty
  map. Service does not crash.
- Service restart during absorption window: the `setTimeout` is dropped.
  On restart, the user-facing opId is on disk. Next user action or next
  idle interval fires.

## Section 7: Estimated scope

- Files added: 3 (`unifiedScheduler.ts`, `staleLegs.ts`,
  `operationsStore.ts`).
- Files modified: 7 (`server.ts`, `syncRequirements.ts`,
  `frontend/src/lib/types/bridge.ts`,
  `frontend/src/lib/stores/proofs.svelte.ts`,
  `frontend/src/lib/utils/bridge-keeper.ts`,
  `frontend/src/lib/components/BridgeForm.svelte`,
  `frontend/src/lib/components/WithdrawForm.svelte`).
- Files deleted (step 7): 2 (`aztecHeartbeat.ts`, `syncOrchestrator.ts`).
- Net LOC: roughly +500 / -350.
- Risk: medium-high. Scheduler sits in the critical bridge path. Mitigated
  by feature flag in step 4 plus observable `/health.scheduler` plus the
  fact that `executor.ts` is unchanged.
- Hours: 12-18 h focused work, plus 2-3 days staging soak before flipping
  the flag in production.
