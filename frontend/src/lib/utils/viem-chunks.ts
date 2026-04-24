import type { Abi, AbiEvent, Address, GetLogsParameters, Log, PublicClient } from 'viem';

function minBigInt(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

// Defaults are tuned for a paid Infura/Alchemy tier, with env overrides for
// slower RPCs. Sequential 499-block scans over ~1.5M Sepolia blocks take
// ~3000 calls - parallelism + larger chunks drops that into the seconds range.
const ENV_CHUNK_SIZE = import.meta.env?.VITE_RPC_CHUNK_SIZE;
const ENV_CONCURRENCY = import.meta.env?.VITE_RPC_CONCURRENCY;

const DEFAULT_CHUNK_SIZE: bigint = ENV_CHUNK_SIZE ? BigInt(ENV_CHUNK_SIZE) : 10_000n;
const DEFAULT_CONCURRENCY: number = ENV_CONCURRENCY ? Number(ENV_CONCURRENCY) : 10;

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
		return (await publicClient.getLogs({
			address,
			event: eventAbi,
			args: eventFilterArgs,
			fromBlock: start,
			toBlock: stop,
		})) as Log<bigint, number, false, TAbiEvent, true>[];
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
