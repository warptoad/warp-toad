import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface L2ScrollBridgeAdapterInterface extends Interface {
    getFunction(nameOrSignature: "gigaRoot" | "receiveGigaRoot" | "sendGigaRoot" | "sentLocalRootToL1(uint256)" | "sentLocalRootToL1()"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "NewGigaRoot" | "SentLocalRootToL1"): EventFragment;
    encodeFunctionData(functionFragment: "gigaRoot", values?: undefined): string;
    encodeFunctionData(functionFragment: "receiveGigaRoot", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "sendGigaRoot", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "sentLocalRootToL1(uint256)", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "sentLocalRootToL1()", values?: undefined): string;
    decodeFunctionResult(functionFragment: "gigaRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "receiveGigaRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendGigaRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sentLocalRootToL1(uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sentLocalRootToL1()", data: BytesLike): Result;
}
export declare namespace NewGigaRootEvent {
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
export declare namespace SentLocalRootToL1Event {
    type InputTuple = [localRoot: BigNumberish];
    type OutputTuple = [localRoot: bigint];
    interface OutputObject {
        localRoot: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface L2ScrollBridgeAdapter extends BaseContract {
    connect(runner?: ContractRunner | null): L2ScrollBridgeAdapter;
    waitForDeployment(): Promise<this>;
    interface: L2ScrollBridgeAdapterInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    gigaRoot: TypedContractMethod<[], [bigint], "view">;
    receiveGigaRoot: TypedContractMethod<[
        _gigaRoot: BigNumberish
    ], [
        void
    ], "payable">;
    sendGigaRoot: TypedContractMethod<[
        _gigaRootRecipient: AddressLike
    ], [
        void
    ], "payable">;
    "sentLocalRootToL1(uint256)": TypedContractMethod<[
        _gasLimit: BigNumberish
    ], [
        void
    ], "nonpayable">;
    "sentLocalRootToL1()": TypedContractMethod<[], [void], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "gigaRoot"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "receiveGigaRoot"): TypedContractMethod<[_gigaRoot: BigNumberish], [void], "payable">;
    getFunction(nameOrSignature: "sendGigaRoot"): TypedContractMethod<[_gigaRootRecipient: AddressLike], [void], "payable">;
    getFunction(nameOrSignature: "sentLocalRootToL1(uint256)"): TypedContractMethod<[_gasLimit: BigNumberish], [void], "nonpayable">;
    getFunction(nameOrSignature: "sentLocalRootToL1()"): TypedContractMethod<[], [void], "nonpayable">;
    getEvent(key: "NewGigaRoot"): TypedContractEvent<NewGigaRootEvent.InputTuple, NewGigaRootEvent.OutputTuple, NewGigaRootEvent.OutputObject>;
    getEvent(key: "SentLocalRootToL1"): TypedContractEvent<SentLocalRootToL1Event.InputTuple, SentLocalRootToL1Event.OutputTuple, SentLocalRootToL1Event.OutputObject>;
    filters: {
        "NewGigaRoot(uint256)": TypedContractEvent<NewGigaRootEvent.InputTuple, NewGigaRootEvent.OutputTuple, NewGigaRootEvent.OutputObject>;
        NewGigaRoot: TypedContractEvent<NewGigaRootEvent.InputTuple, NewGigaRootEvent.OutputTuple, NewGigaRootEvent.OutputObject>;
        "SentLocalRootToL1(uint256)": TypedContractEvent<SentLocalRootToL1Event.InputTuple, SentLocalRootToL1Event.OutputTuple, SentLocalRootToL1Event.OutputObject>;
        SentLocalRootToL1: TypedContractEvent<SentLocalRootToL1Event.InputTuple, SentLocalRootToL1Event.OutputTuple, SentLocalRootToL1Event.OutputObject>;
    };
}
