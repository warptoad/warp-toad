import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface L1ScrollBridgeAdapterInterface extends Interface {
    getFunction(nameOrSignature: "getLocalRootAndBlock" | "getNewRootFromL2" | "gigaBridge" | "initialize" | "l1ScrollMessenger" | "l2ScrollBridgeAdapter" | "mostRecentL2Root" | "mostRecentL2RootBlockNumber" | "receiveGigaRoot(uint256)" | "receiveGigaRoot(uint256,uint256)"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ReceivedNewL2Root"): EventFragment;
    encodeFunctionData(functionFragment: "getLocalRootAndBlock", values?: undefined): string;
    encodeFunctionData(functionFragment: "getNewRootFromL2", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "gigaBridge", values?: undefined): string;
    encodeFunctionData(functionFragment: "initialize", values: [AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: "l1ScrollMessenger", values?: undefined): string;
    encodeFunctionData(functionFragment: "l2ScrollBridgeAdapter", values?: undefined): string;
    encodeFunctionData(functionFragment: "mostRecentL2Root", values?: undefined): string;
    encodeFunctionData(functionFragment: "mostRecentL2RootBlockNumber", values?: undefined): string;
    encodeFunctionData(functionFragment: "receiveGigaRoot(uint256)", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "receiveGigaRoot(uint256,uint256)", values: [BigNumberish, BigNumberish]): string;
    decodeFunctionResult(functionFragment: "getLocalRootAndBlock", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getNewRootFromL2", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "gigaBridge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "l1ScrollMessenger", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "l2ScrollBridgeAdapter", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "mostRecentL2Root", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "mostRecentL2RootBlockNumber", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "receiveGigaRoot(uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "receiveGigaRoot(uint256,uint256)", data: BytesLike): Result;
}
export declare namespace ReceivedNewL2RootEvent {
    type InputTuple = [newL2Root: BigNumberish, l2Block: BigNumberish];
    type OutputTuple = [newL2Root: bigint, l2Block: bigint];
    interface OutputObject {
        newL2Root: bigint;
        l2Block: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface L1ScrollBridgeAdapter extends BaseContract {
    connect(runner?: ContractRunner | null): L1ScrollBridgeAdapter;
    waitForDeployment(): Promise<this>;
    interface: L1ScrollBridgeAdapterInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getLocalRootAndBlock: TypedContractMethod<[], [[bigint, bigint]], "view">;
    getNewRootFromL2: TypedContractMethod<[
        _l2Root: BigNumberish,
        _l2BlockNumber: BigNumberish
    ], [
        void
    ], "nonpayable">;
    gigaBridge: TypedContractMethod<[], [string], "view">;
    initialize: TypedContractMethod<[
        _l2ScrollBridgeAdapter: AddressLike,
        _gigaRootBridge: AddressLike
    ], [
        void
    ], "nonpayable">;
    l1ScrollMessenger: TypedContractMethod<[], [string], "view">;
    l2ScrollBridgeAdapter: TypedContractMethod<[], [string], "view">;
    mostRecentL2Root: TypedContractMethod<[], [bigint], "view">;
    mostRecentL2RootBlockNumber: TypedContractMethod<[], [bigint], "view">;
    "receiveGigaRoot(uint256)": TypedContractMethod<[
        _newGigaRoot: BigNumberish
    ], [
        void
    ], "payable">;
    "receiveGigaRoot(uint256,uint256)": TypedContractMethod<[
        _newGigaRoot: BigNumberish,
        _gasLimit: BigNumberish
    ], [
        void
    ], "payable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "getLocalRootAndBlock"): TypedContractMethod<[], [[bigint, bigint]], "view">;
    getFunction(nameOrSignature: "getNewRootFromL2"): TypedContractMethod<[
        _l2Root: BigNumberish,
        _l2BlockNumber: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "gigaBridge"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "initialize"): TypedContractMethod<[
        _l2ScrollBridgeAdapter: AddressLike,
        _gigaRootBridge: AddressLike
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "l1ScrollMessenger"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "l2ScrollBridgeAdapter"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "mostRecentL2Root"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "mostRecentL2RootBlockNumber"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "receiveGigaRoot(uint256)"): TypedContractMethod<[_newGigaRoot: BigNumberish], [void], "payable">;
    getFunction(nameOrSignature: "receiveGigaRoot(uint256,uint256)"): TypedContractMethod<[
        _newGigaRoot: BigNumberish,
        _gasLimit: BigNumberish
    ], [
        void
    ], "payable">;
    getEvent(key: "ReceivedNewL2Root"): TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
    filters: {
        "ReceivedNewL2Root(uint256,uint256)": TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
        ReceivedNewL2Root: TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
    };
}
