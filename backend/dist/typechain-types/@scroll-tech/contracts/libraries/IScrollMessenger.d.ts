import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface IScrollMessengerInterface extends Interface {
    getFunction(nameOrSignature: "sendMessage(address,uint256,bytes,uint256,address)" | "sendMessage(address,uint256,bytes,uint256)" | "xDomainMessageSender"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "FailedRelayedMessage" | "RelayedMessage" | "SentMessage"): EventFragment;
    encodeFunctionData(functionFragment: "sendMessage(address,uint256,bytes,uint256,address)", values: [AddressLike, BigNumberish, BytesLike, BigNumberish, AddressLike]): string;
    encodeFunctionData(functionFragment: "sendMessage(address,uint256,bytes,uint256)", values: [AddressLike, BigNumberish, BytesLike, BigNumberish]): string;
    encodeFunctionData(functionFragment: "xDomainMessageSender", values?: undefined): string;
    decodeFunctionResult(functionFragment: "sendMessage(address,uint256,bytes,uint256,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendMessage(address,uint256,bytes,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "xDomainMessageSender", data: BytesLike): Result;
}
export declare namespace FailedRelayedMessageEvent {
    type InputTuple = [messageHash: BytesLike];
    type OutputTuple = [messageHash: string];
    interface OutputObject {
        messageHash: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace RelayedMessageEvent {
    type InputTuple = [messageHash: BytesLike];
    type OutputTuple = [messageHash: string];
    interface OutputObject {
        messageHash: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace SentMessageEvent {
    type InputTuple = [
        sender: AddressLike,
        target: AddressLike,
        value: BigNumberish,
        messageNonce: BigNumberish,
        gasLimit: BigNumberish,
        message: BytesLike
    ];
    type OutputTuple = [
        sender: string,
        target: string,
        value: bigint,
        messageNonce: bigint,
        gasLimit: bigint,
        message: string
    ];
    interface OutputObject {
        sender: string;
        target: string;
        value: bigint;
        messageNonce: bigint;
        gasLimit: bigint;
        message: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IScrollMessenger extends BaseContract {
    connect(runner?: ContractRunner | null): IScrollMessenger;
    waitForDeployment(): Promise<this>;
    interface: IScrollMessengerInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    "sendMessage(address,uint256,bytes,uint256,address)": TypedContractMethod<[
        target: AddressLike,
        value: BigNumberish,
        message: BytesLike,
        gasLimit: BigNumberish,
        refundAddress: AddressLike
    ], [
        void
    ], "payable">;
    "sendMessage(address,uint256,bytes,uint256)": TypedContractMethod<[
        target: AddressLike,
        value: BigNumberish,
        message: BytesLike,
        gasLimit: BigNumberish
    ], [
        void
    ], "payable">;
    xDomainMessageSender: TypedContractMethod<[], [string], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "sendMessage(address,uint256,bytes,uint256,address)"): TypedContractMethod<[
        target: AddressLike,
        value: BigNumberish,
        message: BytesLike,
        gasLimit: BigNumberish,
        refundAddress: AddressLike
    ], [
        void
    ], "payable">;
    getFunction(nameOrSignature: "sendMessage(address,uint256,bytes,uint256)"): TypedContractMethod<[
        target: AddressLike,
        value: BigNumberish,
        message: BytesLike,
        gasLimit: BigNumberish
    ], [
        void
    ], "payable">;
    getFunction(nameOrSignature: "xDomainMessageSender"): TypedContractMethod<[], [string], "view">;
    getEvent(key: "FailedRelayedMessage"): TypedContractEvent<FailedRelayedMessageEvent.InputTuple, FailedRelayedMessageEvent.OutputTuple, FailedRelayedMessageEvent.OutputObject>;
    getEvent(key: "RelayedMessage"): TypedContractEvent<RelayedMessageEvent.InputTuple, RelayedMessageEvent.OutputTuple, RelayedMessageEvent.OutputObject>;
    getEvent(key: "SentMessage"): TypedContractEvent<SentMessageEvent.InputTuple, SentMessageEvent.OutputTuple, SentMessageEvent.OutputObject>;
    filters: {
        "FailedRelayedMessage(bytes32)": TypedContractEvent<FailedRelayedMessageEvent.InputTuple, FailedRelayedMessageEvent.OutputTuple, FailedRelayedMessageEvent.OutputObject>;
        FailedRelayedMessage: TypedContractEvent<FailedRelayedMessageEvent.InputTuple, FailedRelayedMessageEvent.OutputTuple, FailedRelayedMessageEvent.OutputObject>;
        "RelayedMessage(bytes32)": TypedContractEvent<RelayedMessageEvent.InputTuple, RelayedMessageEvent.OutputTuple, RelayedMessageEvent.OutputObject>;
        RelayedMessage: TypedContractEvent<RelayedMessageEvent.InputTuple, RelayedMessageEvent.OutputTuple, RelayedMessageEvent.OutputObject>;
        "SentMessage(address,address,uint256,uint256,uint256,bytes)": TypedContractEvent<SentMessageEvent.InputTuple, SentMessageEvent.OutputTuple, SentMessageEvent.OutputObject>;
        SentMessage: TypedContractEvent<SentMessageEvent.InputTuple, SentMessageEvent.OutputTuple, SentMessageEvent.OutputObject>;
    };
}
