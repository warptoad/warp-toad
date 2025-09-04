import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
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
    type L1ActorStruct = {
        actor: AddressLike;
        chainId: BigNumberish;
    };
    type L1ActorStructOutput = [actor: string, chainId: bigint] & {
        actor: string;
        chainId: bigint;
    };
    type L2ToL1MsgStruct = {
        sender: DataStructures.L2ActorStruct;
        recipient: DataStructures.L1ActorStruct;
        content: BytesLike;
    };
    type L2ToL1MsgStructOutput = [
        sender: DataStructures.L2ActorStructOutput,
        recipient: DataStructures.L1ActorStructOutput,
        content: string
    ] & {
        sender: DataStructures.L2ActorStructOutput;
        recipient: DataStructures.L1ActorStructOutput;
        content: string;
    };
}
export interface IOutboxInterface extends Interface {
    getFunction(nameOrSignature: "consume" | "getRootData" | "hasMessageBeenConsumedAtBlockAndIndex" | "insert"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "MessageConsumed" | "RootAdded"): EventFragment;
    encodeFunctionData(functionFragment: "consume", values: [
        DataStructures.L2ToL1MsgStruct,
        BigNumberish,
        BigNumberish,
        BytesLike[]
    ]): string;
    encodeFunctionData(functionFragment: "getRootData", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "hasMessageBeenConsumedAtBlockAndIndex", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "insert", values: [BigNumberish, BytesLike, BigNumberish]): string;
    decodeFunctionResult(functionFragment: "consume", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRootData", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "hasMessageBeenConsumedAtBlockAndIndex", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "insert", data: BytesLike): Result;
}
export declare namespace MessageConsumedEvent {
    type InputTuple = [
        l2BlockNumber: BigNumberish,
        root: BytesLike,
        messageHash: BytesLike,
        leafIndex: BigNumberish
    ];
    type OutputTuple = [
        l2BlockNumber: bigint,
        root: string,
        messageHash: string,
        leafIndex: bigint
    ];
    interface OutputObject {
        l2BlockNumber: bigint;
        root: string;
        messageHash: string;
        leafIndex: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace RootAddedEvent {
    type InputTuple = [
        l2BlockNumber: BigNumberish,
        root: BytesLike,
        minHeight: BigNumberish
    ];
    type OutputTuple = [
        l2BlockNumber: bigint,
        root: string,
        minHeight: bigint
    ];
    interface OutputObject {
        l2BlockNumber: bigint;
        root: string;
        minHeight: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IOutbox extends BaseContract {
    connect(runner?: ContractRunner | null): IOutbox;
    waitForDeployment(): Promise<this>;
    interface: IOutboxInterface;
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
        _message: DataStructures.L2ToL1MsgStruct,
        _l2BlockNumber: BigNumberish,
        _leafIndex: BigNumberish,
        _path: BytesLike[]
    ], [
        void
    ], "nonpayable">;
    getRootData: TypedContractMethod<[
        _l2BlockNumber: BigNumberish
    ], [
        [string, bigint] & {
            root: string;
            minHeight: bigint;
        }
    ], "view">;
    hasMessageBeenConsumedAtBlockAndIndex: TypedContractMethod<[
        _l2BlockNumber: BigNumberish,
        _leafIndex: BigNumberish
    ], [
        boolean
    ], "view">;
    insert: TypedContractMethod<[
        _l2BlockNumber: BigNumberish,
        _root: BytesLike,
        _minHeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "consume"): TypedContractMethod<[
        _message: DataStructures.L2ToL1MsgStruct,
        _l2BlockNumber: BigNumberish,
        _leafIndex: BigNumberish,
        _path: BytesLike[]
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "getRootData"): TypedContractMethod<[
        _l2BlockNumber: BigNumberish
    ], [
        [string, bigint] & {
            root: string;
            minHeight: bigint;
        }
    ], "view">;
    getFunction(nameOrSignature: "hasMessageBeenConsumedAtBlockAndIndex"): TypedContractMethod<[
        _l2BlockNumber: BigNumberish,
        _leafIndex: BigNumberish
    ], [
        boolean
    ], "view">;
    getFunction(nameOrSignature: "insert"): TypedContractMethod<[
        _l2BlockNumber: BigNumberish,
        _root: BytesLike,
        _minHeight: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getEvent(key: "MessageConsumed"): TypedContractEvent<MessageConsumedEvent.InputTuple, MessageConsumedEvent.OutputTuple, MessageConsumedEvent.OutputObject>;
    getEvent(key: "RootAdded"): TypedContractEvent<RootAddedEvent.InputTuple, RootAddedEvent.OutputTuple, RootAddedEvent.OutputObject>;
    filters: {
        "MessageConsumed(uint256,bytes32,bytes32,uint256)": TypedContractEvent<MessageConsumedEvent.InputTuple, MessageConsumedEvent.OutputTuple, MessageConsumedEvent.OutputObject>;
        MessageConsumed: TypedContractEvent<MessageConsumedEvent.InputTuple, MessageConsumedEvent.OutputTuple, MessageConsumedEvent.OutputObject>;
        "RootAdded(uint256,bytes32,uint256)": TypedContractEvent<RootAddedEvent.InputTuple, RootAddedEvent.OutputTuple, RootAddedEvent.OutputObject>;
        RootAdded: TypedContractEvent<RootAddedEvent.InputTuple, RootAddedEvent.OutputTuple, RootAddedEvent.OutputObject>;
    };
}
