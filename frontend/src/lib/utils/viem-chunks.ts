import type { Abi, AbiEvent, Address, GetLogsParameters, Log, PublicClient } from 'viem';

function minBigInt(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

// Defaults lean conservative so a shared free-tier RPC (e.g. public Infura)
// doesn't get 429'd. Bump VITE_RPC_CONCURRENCY / VITE_RPC_CHUNK_SIZE on a paid
// tier for speed. On a 429 each chunk retries with exponential backoff, so a
// brief rate-limit slows the scan instead of failing it.
const ENV_CHUNK_SIZE = import.meta.env?.VITE_RPC_CHUNK_SIZE;
const ENV_CONCURRENCY = import.meta.env?.VITE_RPC_CONCURRENCY;
const ENV_MAX_RETRIES = import.meta.env?.VITE_RPC_MAX_RETRIES;

const DEFAULT_CHUNK_SIZE: bigint = ENV_CHUNK_SIZE ? BigInt(ENV_CHUNK_SIZE) : 10_000n;
const DEFAULT_CONCURRENCY: number = ENV_CONCURRENCY ? Number(ENV_CONCURRENCY) : 4;
// Per-chunk retry budget for rate-limit (429) responses.
const MAX_RPC_RETRIES: number = ENV_MAX_RETRIES ? Number(ENV_MAX_RETRIES) : 5;
const MAX_BACKOFF_MS = 8_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** True for HTTP 429 / "rate limit" / "too many requests" errors from any RPC. */
function isRateLimitError(err: unknown): boolean {
	const e = err as
		| { status?: number; code?: number; message?: string; details?: string; cause?: { status?: number } }
		| null;
	if (e?.status === 429 || e?.code === 429 || e?.cause?.status === 429) return true;
	const msg = `${e?.message ?? ''} ${e?.details ?? ''}`;
	return /\b429\b|too many requests|rate.?limit/i.test(msg);
}

/**
 * Query contract events in chunks, optionally in parallel, to avoid RPC
 * block-range limits while still scanning long ranges quickly.
 *
 * `reverseOrder` + `maxEvents` lets a caller quit after finding the latest N
 * matches without scanning deployment → head. Result order is always
 * earliest → latest.
 *
 * Concurrency runs `concurrency` chunks in parallel via `Promise.all`. The
 * `reverseOrder` path is kept sequential because its whole purpose is to
 * short-circuit as soon as `maxEvents` is filled - parallelism would do
 * unnecessary RPC work there.
 *
 * Ported locally instead of taking a dep on @warptoad/gigabridge-js to avoid
 * disturbing the frontend's pnpm override / wasm-bindgen setup.
 */
export async function queryEventInChunks<
	const TAbi extends Abi,
	const TEventName extends string,
	TAbiEvent extends AbiEvent = Extract<TAbi[number], AbiEvent & { name: TEventName }>
>({
	publicClient,
	contract,
	eventName,
	eventFilterArgs,
	firstBlock = 0n,
	lastBlock,
	reverseOrder = false,
	maxEvents = Infinity,
	chunkSize = DEFAULT_CHUNK_SIZE,
	concurrency = DEFAULT_CONCURRENCY,
	postQueryFilter,
}: {
	publicClient: PublicClient;
	contract: { address: Address; abi: TAbi };
	eventName: TEventName;
	eventFilterArgs?: GetLogsParameters<TAbiEvent>['args'];
	firstBlock?: bigint;
	lastBlock?: bigint;
	reverseOrder?: boolean;
	maxEvents?: number;
	chunkSize?: bigint;
	concurrency?: number;
	postQueryFilter?: (
		events: Log<bigint, number, false, TAbiEvent, true>[]
	) => Log<bigint, number, false, TAbiEvent, true>[];
}): Promise<Log<bigint, number, false, TAbiEvent, true>[]> {
	const { address, abi } = contract;
	const resolvedLast = lastBlock ?? (await publicClient.getBlockNumber());

	const eventAbi = abi.find(
		(item) => item.type === 'event' && (item as AbiEvent).name === eventName
	) as TAbiEvent | undefined;
	if (!eventAbi) throw new Error(`Event "${String(eventName)}" not found in ABI`);

	let allEvents: Log<bigint, number, false, TAbiEvent, true>[] = [];

	const scan = async (index: bigint) => {
		const start = firstBlock + index * chunkSize;
		const stop = minBigInt(start + chunkSize - 1n, resolvedLast);
		let delayMs = 500;
		for (let attempt = 0; ; attempt++) {
			try {
				return (await publicClient.getLogs({
					address,
					event: eventAbi,
					args: eventFilterArgs,
					fromBlock: start,
					toBlock: stop,
				})) as Log<bigint, number, false, TAbiEvent, true>[];
			} catch (err) {
				// Back off and retry on rate-limit responses; rethrow anything else,
				// and give up once the retry budget is spent.
				if (attempt >= MAX_RPC_RETRIES || !isRateLimitError(err)) throw err;
				await sleep(delayMs + Math.floor(Math.random() * 250));
				delayMs = Math.min(delayMs * 2, MAX_BACKOFF_MS);
			}
		}
	};

	const range = resolvedLast - firstBlock + 1n;
	const numIters = Math.max(0, Math.ceil(Number(range) / Number(chunkSize)));

	if (reverseOrder) {
		// Reverse path short-circuits once maxEvents is hit; parallelism would
		// do wasted RPC work. Keep sequential.
		for (let index = BigInt(numIters - 1); index >= 0n; index--) {
			const events = await scan(index);
			allEvents = [...events, ...allEvents];
			if (postQueryFilter) allEvents = postQueryFilter(allEvents);
			allEvents = allEvents.slice(-maxEvents);
			if (allEvents.length >= maxEvents) break;
		}
		return allEvents;
	}

	// Forward path: run `concurrency` chunks in parallel per wave.
	const waveSize = Math.max(1, concurrency);
	for (let waveStart = 0; waveStart < numIters; waveStart += waveSize) {
		const waveEnd = Math.min(waveStart + waveSize, numIters);
		const indices = Array.from({ length: waveEnd - waveStart }, (_, i) =>
			BigInt(waveStart + i),
		);
		const waves = await Promise.all(indices.map(scan));
		for (const events of waves) {
			allEvents = [...allEvents, ...events];
		}
		if (postQueryFilter) allEvents = postQueryFilter(allEvents);
		if (allEvents.length >= maxEvents) {
			allEvents = allEvents.slice(0, maxEvents);
			break;
		}
	}

	return allEvents;
}
