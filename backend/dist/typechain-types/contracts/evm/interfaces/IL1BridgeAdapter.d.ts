import type { BaseContract, BigNumberish, FunctionFragment, Interface, EventFragment, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener } from "../../../common";
export interface IL1BridgeAdapterInterface extends Interface {
    getEvent(nameOrSignatureOrTopic: "ReceivedNewL2Root"): EventFragment;
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
export interface IL1BridgeAdapter extends BaseContract {
    connect(runner?: ContractRunner | null): IL1BridgeAdapter;
    waitForDeployment(): Promise<this>;
    interface: IL1BridgeAdapterInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getEvent(key: "ReceivedNewL2Root"): TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
    filters: {
        "ReceivedNewL2Root(uint256,uint256)": TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
        ReceivedNewL2Root: TypedContractEvent<ReceivedNewL2RootEvent.InputTuple, ReceivedNewL2RootEvent.OutputTuple, ReceivedNewL2RootEvent.OutputObject>;
    };
}
