#!/usr/bin/env bash
#
# local-test.sh - bring up the whole warptoad stack locally for an ETH <-> Aztec
# test run, in the right order, with the local-only env overrides baked in.
#
# What it does (each long-running piece runs in the background, logs to
# .local-stack/logs/, and is torn down when you Ctrl+C this script):
#   1. sandbox   - `pnpm b:sandbox` (anvil :8545 + Aztec PXE/node :8080), unless
#                  one is already listening on :8080 (then it's reused, not killed)
#   2. deploy    - `pnpm l:deploy`  (compiles backend -> deploys L1 + Aztec -> pulls addresses)
#   3. abis      - `pnpm f:prep`    (regenerates frontend ABIs from the fresh artifacts)
#   4. frontend  - sets VITE_TEST_MODE=true, `pnpm --filter frontend build` then `preview` (:4173)
#   5. bridge-sync - started with LOCAL overrides (sandbox Aztec node, heartbeat off,
#                    funded anvil key); REQUIRED for a burn to mint on the other side
#   6. relay-service - optional (--with-relay), best-effort local config
#
# Why the overrides exist: the service .env files hold production/testnet values
# (testnet Aztec node, non-anvil keys), so a plain `pnpm dev` hammers the dead
# testnet node and signs with an unfunded key. See the gotchas in the team runbook.
#
# Usage:
#   ./scripts/local-test.sh                  # full stack (reuses a running sandbox)
#   ./scripts/local-test.sh --with-relay     # also start relay-service
#   ./scripts/local-test.sh --no-sandbox     # don't boot a sandbox; require one on :8080
#   ./scripts/local-test.sh --no-services    # sandbox + deploy + frontend only
#   ./scripts/local-test.sh --no-build       # skip frontend build/preview
#   ./scripts/local-test.sh --no-deploy      # reuse the current deploy (skip l:deploy + f:prep)
#   ./scripts/local-test.sh --help
#
set -euo pipefail

# --- repo root (script lives in <repo>/scripts) ---------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- config (override via env) --------------------------------------------------
PXE_PORT="${PXE_PORT:-8080}"
ANVIL_PORT="${ANVIL_PORT:-8545}"
PREVIEW_PORT="${PREVIEW_PORT:-4173}"
BRIDGE_PORT="${BRIDGE_PORT:-6969}"
RELAY_PORT="${RELAY_PORT:-7777}"
AZTEC_LOCAL_URL="${AZTEC_LOCAL_URL:-http://localhost:${PXE_PORT}}"

# Default anvil/hardhat dev accounts (well-known, local only - never real funds).
# bridge-sync uses #0, relay uses #1 (different keys avoid nonce races).
ANVIL_KEY_0="${ANVIL_KEY_0:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
ANVIL_KEY_1="${ANVIL_KEY_1:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}"
ANVIL_ADDR_1="${ANVIL_ADDR_1:-0x70997970C51812dc3A010C7d01b50e0d17dc79C8}"

SANDBOX_TIMEOUT="${SANDBOX_TIMEOUT:-240}"        # secs to wait for :8080 -> 405
SANDBOX_SETTLE="${SANDBOX_SETTLE:-20}"           # extra secs after ready (bootstrap txs drain)
HTTP_TIMEOUT="${HTTP_TIMEOUT:-60}"               # secs to wait for preview / bridge-sync

LOG_DIR="$REPO_ROOT/.local-stack/logs"

# --- flags ----------------------------------------------------------------------
DO_SANDBOX=1 DO_DEPLOY=1 DO_BUILD=1 DO_SERVICES=1 DO_RELAY=0
for arg in "$@"; do
  case "$arg" in
    --no-sandbox)  DO_SANDBOX=0 ;;
    --no-deploy)   DO_DEPLOY=0 ;;
    --no-build)    DO_BUILD=0 ;;
    --no-services) DO_SERVICES=0 ;;
    --with-relay)  DO_RELAY=1 ;;
    -h|--help)
      awk 'NR==1{next} /^#/{sub(/^# ?/,"");print;next} {exit}' "${BASH_SOURCE[0]}"
      exit 0 ;;
    *) echo "unknown flag: $arg (try --help)" >&2; exit 2 ;;
  esac
done

# --- pretty logging -------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_B=$'\033[1m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_R=$'\033[31m'; C_0=$'\033[0m'
else C_B=""; C_G=""; C_Y=""; C_R=""; C_0=""; fi
log()  { echo "${C_G}${C_B}==>${C_0} $*"; }
warn() { echo "${C_Y}${C_B}warn:${C_0} $*" >&2; }
err()  { echo "${C_R}${C_B}error:${C_0} $*" >&2; }

# --- process management ---------------------------------------------------------
PIDS=() ; LABELS=() ; TAIL_LOGS=() ; CLEANED=""
SETSID="$(command -v setsid || true)"

start_bg() { # start_bg <logfile> <label> <cmd...>
  local logf="$1" label="$2"; shift 2
  : > "$logf"
  if [ -n "$SETSID" ]; then "$SETSID" env "$@" >>"$logf" 2>&1 &
  else env "$@" >>"$logf" 2>&1 & fi
  PIDS+=("$!"); LABELS+=("$label")
  log "started ${C_B}${label}${C_0} (pid $!) -> ${logf#$REPO_ROOT/}"
}

cleanup() {
  [ -n "$CLEANED" ] && return; CLEANED=1
  [ ${#PIDS[@]} -eq 0 ] && return
  echo; log "stopping ${#PIDS[@]} managed service(s)..."
  local pid
  for pid in "${PIDS[@]}"; do
    kill -0 "$pid" 2>/dev/null || continue
    kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    pkill -TERM -P "$pid" 2>/dev/null || true
  done
  sleep 1 || true
  for pid in "${PIDS[@]}"; do kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true; done
  log "stack down."
}
trap cleanup EXIT INT TERM

# --- helpers --------------------------------------------------------------------
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$1" 2>/dev/null || echo 000; }

wait_http() { # wait_http <url> <want_code> <timeout_s> <label>
  local url="$1" want="$2" timeout="$3" label="$4" waited=0 code
  printf '  waiting for %s' "$label"
  while :; do
    code="$(http_code "$url")"
    if [ "$code" = "$want" ]; then printf ' ... ready (%s)\n' "$code"; return 0; fi
    waited=$((waited + 2))
    if [ "$waited" -ge "$timeout" ]; then printf ' ... TIMEOUT (last=%s)\n' "$code"; return 1; fi
    printf '.'; sleep 2
  done
}

need() { command -v "$1" >/dev/null 2>&1 || { err "'$1' not found on PATH"; exit 1; }; }

ensure_vite_test_mode() {
  local envf="$REPO_ROOT/frontend/.env"
  if [ ! -f "$envf" ]; then
    warn "frontend/.env missing - creating it with VITE_TEST_MODE=true"
    printf 'VITE_TEST_MODE=true\nVITE_LOCAL_AZTEC_NODE_URL=%s\n' "$AZTEC_LOCAL_URL" > "$envf"
    return
  fi
  if grep -q '^VITE_TEST_MODE=' "$envf"; then
    sed -i 's/^VITE_TEST_MODE=.*/VITE_TEST_MODE=true/' "$envf"
  else
    printf '\nVITE_TEST_MODE=true\n' >> "$envf"
  fi
}

# --- preflight ------------------------------------------------------------------
need pnpm; need curl
mkdir -p "$LOG_DIR"
log "warptoad local stack  (repo: $REPO_ROOT)"

# --- 1. sandbox -----------------------------------------------------------------
if [ "$(http_code "http://localhost:${PXE_PORT}")" = "405" ]; then
  log "sandbox already up on :${PXE_PORT} - reusing it (won't be stopped on exit)"
elif [ "$DO_SANDBOX" -eq 1 ]; then
  need aztec
  log "booting sandbox (pnpm b:sandbox)..."
  start_bg "$LOG_DIR/sandbox.log" "sandbox" pnpm b:sandbox
  if ! wait_http "http://localhost:${PXE_PORT}" 405 "$SANDBOX_TIMEOUT" "Aztec node :${PXE_PORT}"; then
    err "sandbox did not become ready - see $LOG_DIR/sandbox.log"; exit 1
  fi
  log "letting sandbox settle ${SANDBOX_SETTLE}s (bootstrap txs)..."; sleep "$SANDBOX_SETTLE"
else
  err "no sandbox on :${PXE_PORT} and --no-sandbox set. Run 'pnpm b:sandbox' first."; exit 1
fi

# --- 2 + 3. deploy + abis -------------------------------------------------------
if [ "$DO_DEPLOY" -eq 1 ]; then
  log "deploying to sandbox (pnpm l:deploy)..."
  HARDHAT_IGNITION_CONFIRM_DEPLOYMENT=1 HARDHAT_IGNITION_CONFIRM_RESET=1 \
    pnpm l:deploy 2>&1 | tee "$LOG_DIR/deploy.log"
  log "regenerating ABIs + addresses (pnpm f:prep)..."
  pnpm f:prep 2>&1 | tee "$LOG_DIR/fprep.log"
else
  warn "skipping deploy (--no-deploy) - reusing whatever is currently deployed"
fi

# --- 4. frontend ----------------------------------------------------------------
if [ "$DO_BUILD" -eq 1 ]; then
  log "setting VITE_TEST_MODE=true and building frontend..."
  ensure_vite_test_mode
  pnpm --filter frontend build 2>&1 | tee "$LOG_DIR/build.log"
  if [ "$(http_code "http://localhost:${PREVIEW_PORT}")" = "200" ]; then
    warn "something already serving :${PREVIEW_PORT} - not starting a second preview"
  else
    start_bg "$LOG_DIR/preview.log" "frontend-preview" pnpm --filter frontend preview
    wait_http "http://localhost:${PREVIEW_PORT}" 200 "$HTTP_TIMEOUT" "frontend :${PREVIEW_PORT}" || \
      warn "preview not responding yet - check $LOG_DIR/preview.log"
    TAIL_LOGS+=("$LOG_DIR/preview.log")
  fi
else
  warn "skipping frontend build (--no-build)"
fi

# --- 5. bridge-sync (REQUIRED for cross-chain root propagation) ------------------
if [ "$DO_SERVICES" -eq 1 ]; then
  if [ "$(http_code "http://localhost:${BRIDGE_PORT}/health")" = "200" ]; then
    warn "bridge-sync already up on :${BRIDGE_PORT} - reusing"
  else
    log "starting bridge-sync with local overrides..."
    start_bg "$LOG_DIR/bridge-sync.log" "bridge-sync" \
      SYNC_L1_CHAIN_ID=31337 \
      AZTEC_NODE_URL="$AZTEC_LOCAL_URL" \
      AZTEC_HEARTBEAT_ENABLED=false \
      EVM_PRIVATE_KEY="$ANVIL_KEY_0" \
      PORT="$BRIDGE_PORT" \
      pnpm --filter @warp-toad/bridge-sync dev
    wait_http "http://localhost:${BRIDGE_PORT}/health" 200 "$HTTP_TIMEOUT" "bridge-sync :${BRIDGE_PORT}" || \
      warn "bridge-sync /health not green yet - check $LOG_DIR/bridge-sync.log"
    TAIL_LOGS=("$LOG_DIR/bridge-sync.log")   # bridge-sync is the one worth watching live
  fi

  # --- 6. relay-service (optional) ----------------------------------------------
  if [ "$DO_RELAY" -eq 1 ]; then
    log "starting relay-service (optional, best-effort local config)..."
    warn "relay also reads WITHDRAW_VERIFIER_ADDRESS from its .env (testnet value); local mint may need it updated"
    start_bg "$LOG_DIR/relay.log" "relay-service" \
      AZTEC_RPC_URL="$AZTEC_LOCAL_URL" \
      RELAYER_PRIVATE_KEY="$ANVIL_KEY_1" \
      RELAYER_ADDRESS="$ANVIL_ADDR_1" \
      PORT="$RELAY_PORT" \
      pnpm --filter @warp-toad/relay-service dev
    TAIL_LOGS+=("$LOG_DIR/relay.log")
  fi
else
  warn "skipping services (--no-services) - a burn will NOT mint on the other side without bridge-sync"
fi

# --- dashboard ------------------------------------------------------------------
echo
log "${C_B}stack is up${C_0}"
echo "  frontend     : http://localhost:${PREVIEW_PORT}"
echo "  anvil (L1)   : http://localhost:${ANVIL_PORT}   chainId 31337"
echo "  aztec node   : ${AZTEC_LOCAL_URL}"
[ "$DO_SERVICES" -eq 1 ] && echo "  bridge-sync  : http://localhost:${BRIDGE_PORT}/health"
[ "$DO_RELAY" -eq 1 ]    && echo "  relay        : http://localhost:${RELAY_PORT}"
echo "  logs         : ${LOG_DIR#$REPO_ROOT/}/"
echo
echo "  MetaMask: add network RPC http://localhost:${ANVIL_PORT}, chainId 31337,"
echo "            import anvil account 0 for gas. Aztec wallet auto-loads from sandbox test accounts."
echo "  Note: frontend/.env VITE_TEST_MODE was set to true - flip back to false before any testnet build."
echo

# --- hold open + tail -----------------------------------------------------------
if [ ${#PIDS[@]} -eq 0 ]; then
  log "nothing long-running was started by this run; done."
  trap - EXIT; exit 0
fi
if [ ${#TAIL_LOGS[@]} -gt 0 ]; then
  log "tailing logs - press ${C_B}Ctrl+C${C_0} to stop the whole stack"
  echo
  tail -n +1 -f "${TAIL_LOGS[@]}" || true
else
  log "services running - press ${C_B}Ctrl+C${C_0} to stop"
  wait
fi
