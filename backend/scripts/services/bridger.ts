import "dotenv/config";
import express from "express";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type JobName = "aztec" | "scroll";
type JobState = "idle" | "running" | "success" | "failed";

const PORT = Number(process.env.PORT ?? "7070");
const HOURLY_ENABLED = (process.env.HOURLY_ENABLED ?? "true") === "true";
const RUN_ON_START = (process.env.RUN_ON_START ?? "false") === "true";

const EVM_PRIVATE_KEY = must("EVM_PRIVATE_KEY");
const L1_RPC = must("L1_RPC");
const L2_AZTEC_RPC = must("L2_AZTEC_RPC");
const L2_SCROLL_RPC = must("L2_SCROLL_RPC");

// Where to run yarn workspace commands from (repo root usually)
const WORKDIR = process.env.WORKDIR ?? process.cwd();

// Logs
const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), ".bridge-runner-logs");
fs.mkdirSync(LOG_DIR, { recursive: true });

// Overlap protection
const locks: Record<JobName, boolean> = { aztec: false, scroll: false };

// Status
const status: Record<JobName, {
  state: JobState;
  lastStart?: number;
  lastEnd?: number;
  lastExitCode?: number;
  lastError?: string;
  logFile?: string;
}> = {
  aztec: { state: "idle" },
  scroll: { state: "idle" },
};

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function buildCommand(job: JobName) {
  // You said your args are in .env; we still pass them explicitly so the command is reproducible.
  // IMPORTANT: use the exact flag names your bridge.ts expects (your earlier example uses --evmPrivatekey).
  if (job === "aztec") {
    return {
      cmd: "yarn",
      args: [
        "workspace",
        "@warp-toad/backend",
        "bun",
        "scripts/scripts/bridge.ts",
        "--L1Rpc",
        L1_RPC,
        "--L2Rpc",
        L2_AZTEC_RPC,
        "--evmPrivatekey",
        EVM_PRIVATE_KEY,
        "--isAztec",
      ],
    };
  }

  return {
    cmd: "yarn",
    args: [
      "workspace",
      "@warp-toad/backend",
      "bun",
      "scripts/scripts/bridge.ts",
      "--L1Rpc",
      L1_RPC,
      "--L2Rpc",
      L2_SCROLL_RPC,
      "--evmPrivatekey",
      EVM_PRIVATE_KEY,
      // scroll is EVM L2, so do NOT pass --isAztec
    ],
  };
}

async function runJob(job: JobName) {
  if (locks[job]) {
    return { ok: false, message: `Job '${job}' already running` as const };
  }
  locks[job] = true;

  const stamp = nowStamp();
  const logFile = path.join(LOG_DIR, `${job}_${stamp}.log`);
  const out = fs.createWriteStream(logFile, { flags: "a" });

  const { cmd, args } = buildCommand(job);

  status[job] = {
    state: "running",
    lastStart: Date.now(),
    logFile,
  };

  out.write(`[bridge-runner] starting ${job} at ${new Date().toISOString()}\n`);
  out.write(`[bridge-runner] cwd=${WORKDIR}\n`);
  out.write(`[bridge-runner] cmd=${cmd} ${args.map(a => JSON.stringify(a)).join(" ")}\n\n`);

  return await new Promise<{ ok: boolean; message: string }>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: WORKDIR,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (d) => out.write(d));
    child.stderr.on("data", (d) => out.write(d));

    child.on("error", (err) => {
      out.write(`\n[bridge-runner] process error: ${String(err)}\n`);
      status[job] = {
        ...status[job],
        state: "failed",
        lastEnd: Date.now(),
        lastExitCode: -1,
        lastError: String(err),
      };
      locks[job] = false;
      out.end();
      resolve({ ok: false, message: `Job '${job}' failed to start: ${String(err)}` });
    });

    child.on("close", (code) => {
      out.write(`\n[bridge-runner] exited with code=${code}\n`);
      status[job] = {
        ...status[job],
        state: code === 0 ? "success" : "failed",
        lastEnd: Date.now(),
        lastExitCode: code ?? -1,
      };
      locks[job] = false;
      out.end();
      resolve({ ok: code === 0, message: `Job '${job}' finished with code=${code}` });
    });
  });
}

// Runs both in a deterministic order.
// If Scroll takes 2-3h, you probably want aztec first or vice versa, choose what you actually want.
// I’m defaulting to scroll first (since it’s long), then aztec.
async function runAll() {
  const a = await runJob("scroll");
  const b = await runJob("aztec");
  return { scroll: a, aztec: b };
}

// hourly (aligned to top of hour)
function startHourly() {
  if (!HOURLY_ENABLED) return;

  const now = new Date();
  const msUntilNextHour =
    (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000 - now.getMilliseconds();

  setTimeout(async () => {
    // If a job is still running, we skip this hour rather than stacking.
    if (!locks.scroll && !locks.aztec) {
      void runAll();
    }
    setInterval(() => {
      if (!locks.scroll && !locks.aztec) void runAll();
    }, 60 * 60 * 1000);
  }, Math.max(0, msUntilNextHour));
}

function must(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env var: ${k}`);
  return v;
}

// ---------------- HTTP SERVER ----------------
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/status", (_req, res) => {
  res.json({
    locks,
    status,
    config: {
      hourlyEnabled: HOURLY_ENABLED,
      runOnStart: RUN_ON_START,
      workdir: WORKDIR,
      logDir: LOG_DIR,
    },
  });
});

app.post("/bridge/aztec", async (_req, res) => res.json(await runJob("aztec")));
app.post("/bridge/scroll", async (_req, res) => res.json(await runJob("scroll")));
app.post("/bridge/all", async (_req, res) => res.json(await runAll()));

app.get("/logs/:job/latest", (req, res) => {
  const job = req.params.job as JobName;
  const file = status[job]?.logFile;
  if (!file || !fs.existsSync(file)) return res.status(404).send("No log yet");
  res.type("text/plain").send(fs.readFileSync(file, "utf8"));
});

app.listen(PORT, () => {
  console.log(`[bridge-runner] listening on :${PORT}`);
  startHourly();
  if (RUN_ON_START) void runAll();
});
