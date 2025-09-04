import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../common";
export interface GigaBridgeInterface extends Interface {
    getFunction(nameOrSignature: "amountOfLocalRoots" | "getLocalRootProvidersIndex" | "gigaRoot" | "isLocalRootProviders" | "localRootBlockNumbers" | "maxTreeDepth" | "rootTreeData" | "sendGigaRoot(address)" | "sendGigaRoot(address[],uint256[])" | "updateGigaRoot"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ConstructedNewGigaRoot" | "ReceivedNewLocalRoot" | "SentGigaRoot"): EventFragment;
    encodeFunctionData(functionFragment: "amountOfLocalRoots", values?: undefined): string;
    encodeFunctionData(functionFragment: "getLocalRootProvidersIndex", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "gigaRoot", values?: undefined): string;
    encodeFunctionData(functionFragment: "isLocalRootProviders", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "localRootBlockNumbers", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "maxTreeDepth", values?: undefined): string;
    encodeFunctionData(functionFragment: "rootTreeData", values?: undefined): string;
    encodeFunctionData(functionFragment: "sendGigaRoot(address)", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "sendGigaRoot(address[],uint256[])", values: [AddressLike[], BigNumberish[]]): string;
    encodeFunctionData(functionFragment: "updateGigaRoot", values: [AddressLike[]]): string;
    decodeFunctionResult(functionFragment: "amountOfLocalRoots", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getLocalRootProvidersIndex", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "gigaRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isLocalRootProviders", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "localRootBlockNumbers", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "maxTreeDepth", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "rootTreeData", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendGigaRoot(address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendGigaRoot(address[],uint256[])", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "updateGigaRoot", data: BytesLike): Result;
}
export declare namespace ConstructedNewGigaRootEvent {
    type InputTuple = [newGigaRoot: BigNumberish];
    type OutputTuple = [newGigaRoot: bigint];
    interface OutputObject {
        newGigaRoot: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace ReceivedNewLocalRootEvent {
    type InputTuple = [
        newLocalRoot: BigNumberish,
        localRootIndex: BigNumberish,
        localRootBlockNumber: BigNumberish
    ];
    type OutputTuple = [
        newLocalRoot: bigint,
        localRootIndex: bigint,
        localRootBlockNumber: bigint
    ];
    interface OutputObject {
        newLocalRoot: bigint;
        localRootIndex: bigint;
        localRootBlockNumber: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace SentGigaRootEvent {
    type InputTuple = [gigaRoot: BigNumberish];
    type OutputTuple = [gigaRoot: bigint];
    interface OutputObject {
        gigaRoot: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface GigaBridge extends BaseContract {
    connect(runner?: ContractRunner | null): GigaBridge;
    waitForDeployment(): Promise<this>;
    interface: GigaBridgeInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    amountOfLocalRoots: TypedContractMethod<[], [bigint], "view">;
    getLocalRootProvidersIndex: TypedContractMethod<[
        _localRootProvider: AddressLike
    ], [
        bigint
    ], "view">;
    gigaRoot: TypedContractMethod<[], [bigint], "view">;
    isLocalRootProviders: TypedContractMethod<[
        _localRootProvider: AddressLike
    ], [
        boolean
    ], "view">;
    localRootBlockNumbers: TypedContractMethod<[
        arg0: AddressLike
    ], [
        bigint
    ], "view">;
    maxTreeDepth: TypedContractMethod<[], [bigint], "view">;
    rootTreeData: TypedContractMethod<[
    ], [
        [bigint, bigint] & {
            maxIndex: bigint;
            numberOfLeaves: bigint;
        }
    ], "view">;
    "sendGigaRoot(address)": TypedContractMethod<[
        _gigaRootRecipient: AddressLike
    ], [
        void
    ], "payable">;
    "sendGigaRoot(address[],uint256[])": TypedContractMethod<[
        _gigaRootRecipients: AddressLike[],
        _amounts: BigNumberish[]
    ], [
        void
    ], "payable">;
    updateGigaRoot: TypedContractMethod<[
        _localRootProvider: AddressLike[]
    ], [
        void
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "amountOfLocalRoots"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "getLocalRootProvidersIndex"): TypedContractMethod<[_localRootProvider: AddressLike], [bigint], "view">;
    getFunction(nameOrSignature: "gigaRoot"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "isLocalRootProviders"): TypedContractMethod<[_localRootProvider: AddressLike], [boolean], "view">;
    getFunction(nameOrSignature: "localRootBlockNumbers"): TypedContractMethod<[arg0: AddressLike], [bigint], "view">;
    getFunction(nameOrSignature: "maxTreeDepth"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "rootTreeData"): TypedContractMethod<[
    ], [
        [bigint, bigint] & {
            maxIndex: bigint;
            numberOfLeaves: bigint;
        }
    ], "view">;
    getFunction(nameOrSignature: "sendGigaRoot(address)"): TypedContractMethod<[_gigaRootRecipient: AddressLike], [void], "payable">;
    getFunction(nameOrSignature: "sendGigaRoot(address[],uint256[])"): TypedContractMethod<[
        _gigaRootRecipients: AddressLike[],
        _amounts: BigNumberish[]
    ], [
        void
    ], "payable">;
    getFunction(nameOrSignature: "updateGigaRoot"): TypedContractMethod<[
        _localRootProvider: AddressLike[]
    ], [
        void
    ], "nonpayable">;
    getEvent(key: "ConstructedNewGigaRoot"): TypedContractEvent<ConstructedNewGigaRootEvent.InputTuple, ConstructedNewGigaRootEvent.OutputTuple, ConstructedNewGigaRootEvent.OutputObject>;
    getEvent(key: "ReceivedNewLocalRoot"): TypedContractEvent<ReceivedNewLocalRootEvent.InputTuple, ReceivedNewLocalRootEvent.OutputTuple, ReceivedNewLocalRootEvent.OutputObject>;
    getEvent(key: "SentGigaRoot"): TypedContractEvent<SentGigaRootEvent.InputTuple, SentGigaRootEvent.OutputTuple, SentGigaRootEvent.OutputObject>;
    filters: {
        "ConstructedNewGigaRoot(uint256)": TypedContractEvent<ConstructedNewGigaRootEvent.InputTuple, ConstructedNewGigaRootEvent.OutputTuple, ConstructedNewGigaRootEvent.OutputObject>;
        ConstructedNewGigaRoot: TypedContractEvent<ConstructedNewGigaRootEvent.InputTuple, ConstructedNewGigaRootEvent.OutputTuple, ConstructedNewGigaRootEvent.OutputObject>;
        "ReceivedNewLocalRoot(uint256,uint40,uint256)": TypedContractEvent<ReceivedNewLocalRootEvent.InputTuple, ReceivedNewLocalRootEvent.OutputTuple, ReceivedNewLocalRootEvent.OutputObject>;
        ReceivedNewLocalRoot: TypedContractEvent<ReceivedNewLocalRootEvent.InputTuple, ReceivedNewLocalRootEvent.OutputTuple, ReceivedNewLocalRootEvent.OutputObject>;
        "SentGigaRoot(uint256)": TypedContractEvent<SentGigaRootEvent.InputTuple, SentGigaRootEvent.OutputTuple, SentGigaRootEvent.OutputObject>;
        SentGigaRoot: TypedContractEvent<SentGigaRootEvent.InputTuple, SentGigaRootEvent.OutputTuple, SentGigaRootEvent.OutputObject>;
    };
}
