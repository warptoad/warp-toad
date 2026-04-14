import type { Abi, AbiEvent, Address, GetLogsParameters, Log, PublicClient } from 'viem';

function minBigInt(a: bigint, b: bigint): bigint {
	return a < b ? a : b;
}

/**
 * Query contract events in chunks to avoid RPC block-range limits.
 *
 * `reverseOrder` + `maxEvents` lets a caller quit after finding the latest N matches
 * without scanning deployment → head. Result order is always earliest → latest.
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
	chunkSize = 499n,
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
		for (let index = BigInt(numIters - 1); index >= 0n; index--) {
			const events = await scan(index);
			allEvents = [...events, ...allEvents];
			if (postQueryFilter) allEvents = postQueryFilter(allEvents);
			allEvents = allEvents.slice(-maxEvents);
			if (allEvents.length >= maxEvents) break;
		}
	} else {
		for (let index = 0n; index < BigInt(numIters); index++) {
			const events = await scan(index);
			allEvents = [...allEvents, ...events];
			if (postQueryFilter) allEvents = postQueryFilter(allEvents);
			allEvents = allEvents.slice(0, maxEvents);
			if (allEvents.length >= maxEvents) break;
		}
	}

	return allEvents;
}
