import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../../common";
export declare namespace DataStructures {
    type L2ActorStruct = {
        actor: BytesLike;
        version: BigNumberish;
    };
    type L2ActorStructOutput = [actor: string, version: bigint] & {
        actor: string;
        version: bigint;
    };
}
export interface IInboxInterface extends Interface {
    getFunction(nameOrSignature: "consume" | "getRoot" | "sendL2Message"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "MessageSent"): EventFragment;
    encodeFunctionData(functionFragment: "consume", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getRoot", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "sendL2Message", values: [DataStructures.L2ActorStruct, BytesLike, BytesLike]): string;
    decodeFunctionResult(functionFragment: "consume", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendL2Message", data: BytesLike): Result;
}
export declare namespace MessageSentEvent {
    type InputTuple = [
        l2BlockNumber: BigNumberish,
        index: BigNumberish,
        hash: BytesLike
    ];
    type OutputTuple = [
        l2BlockNumber: bigint,
        index: bigint,
        hash: string
    ];
    interface OutputObject {
        l2BlockNumber: bigint;
        index: bigint;
        hash: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IInbox extends BaseContract {
    connect(runner?: ContractRunner | null): IInbox;
    waitForDeployment(): Promise<this>;
    interface: IInboxInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    consume: TypedContractMethod<[
        _toConsume: BigNumberish
    ], [
        string
    ], "nonpayable">;
    getRoot: TypedContractMethod<[_blockNumber: BigNumberish], [string], "view">;
    sendL2Message: TypedContractMethod<[
        _recipient: DataStructures.L2ActorStruct,
        _content: BytesLike,
        _secretHash: BytesLike
    ], [
        [string, bigint]
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "consume"): TypedContractMethod<[_toConsume: BigNumberish], [string], "nonpayable">;
    getFunction(nameOrSignature: "getRoot"): TypedContractMethod<[_blockNumber: BigNumberish], [string], "view">;
    getFunction(nameOrSignature: "sendL2Message"): TypedContractMethod<[
        _recipient: DataStructures.L2ActorStruct,
        _content: BytesLike,
        _secretHash: BytesLike
    ], [
        [string, bigint]
    ], "nonpayable">;
    getEvent(key: "MessageSent"): TypedContractEvent<MessageSentEvent.InputTuple, MessageSentEvent.OutputTuple, MessageSentEvent.OutputObject>;
    filters: {
        "MessageSent(uint256,uint256,bytes32)": TypedContractEvent<MessageSentEvent.InputTuple, MessageSentEvent.OutputTuple, MessageSentEvent.OutputObject>;
        MessageSent: TypedContractEvent<MessageSentEvent.InputTuple, MessageSentEvent.OutputTuple, MessageSentEvent.OutputObject>;
    };
}
