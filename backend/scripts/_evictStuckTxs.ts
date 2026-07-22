// TEMPORARY ops helper (safe to delete after use).
// Replaces the stuck zero-tip Ignition deploy txs on Scroll Sepolia (nonces
// 99/100/101) with properly-tipped 0-value self-sends, so the nonce queue
// unblocks. Stop `pnpm t:deploy` BEFORE running this, or Ignition and this
// script will fight over the same nonces.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read backend/.env directly (the repo uses the dotenv-cli binary, not the lib).
function readEnv(key: string): string | undefined {
  try {
    const text = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*?)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return process.env[key];
}

const RPC = readEnv("SCROLL_SEPOLIA_RPC_URL");
const PK_RAW = readEnv("DEPLOYER_PRIVATE_KEY");
if (!RPC || !PK_RAW) throw new Error("missing SCROLL_SEPOLIA_RPC_URL or DEPLOYER_PRIVATE_KEY in backend/.env");
const PK = (PK_RAW.startsWith("0x") ? PK_RAW : `0x${PK_RAW}`) as `0x${string}`;

const STUCK_NONCES = [99, 100, 101];
const maxPriorityFeePerGas = 100_000_000n; // 0.1 gwei tip
const maxFeePerGas = 500_000_000n; // 0.5 gwei ceiling (base fee is ~0.016 gwei)

const scrollSepolia = defineChain({
  id: 534351,
  name: "Scroll Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: scrollSepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: scrollSepolia, transport: http(RPC) });

async function main() {
  const latest = await pub.getTransactionCount({ address: account.address, blockTag: "latest" });
  const pending = await pub.getTransactionCount({ address: account.address, blockTag: "pending" });
  console.log(`deployer: ${account.address}`);
  console.log(`nonce latest=${latest} pending=${pending}`);

  const targets = STUCK_NONCES.filter((n) => n >= latest);
  if (targets.length === 0) {
    console.log("nonces 99-101 already mined; nothing to evict.");
    return;
  }

  const sent: `0x${string}`[] = [];
  for (const nonce of targets) {
    const hash = await wallet.sendTransaction({
      to: account.address,
      value: 0n,
      nonce,
      gas: 21000n,
      maxFeePerGas,
      maxPriorityFeePerGas,
    });
    console.log(`nonce ${nonce}: replacement sent -> ${hash}`);
    sent.push(hash);
  }

  console.log("waiting for confirmations...");
  for (const hash of sent) {
    const r = await pub.waitForTransactionReceipt({ hash, timeout: 180_000 });
    console.log(`  ${hash} mined in block ${r.blockNumber} (status=${r.status})`);
  }

  const newLatest = await pub.getTransactionCount({ address: account.address, blockTag: "latest" });
  console.log(`done. nonce latest is now ${newLatest} (>=102 means the queue is unblocked).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
