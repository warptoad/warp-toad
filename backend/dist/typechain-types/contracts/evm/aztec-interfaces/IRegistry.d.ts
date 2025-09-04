import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface IRegistryInterface extends Interface {
    getFunction(nameOrSignature: "addRollup" | "getCanonicalRollup" | "getGovernance" | "getRewardDistributor" | "getRollup" | "getVersion" | "numberOfVersions" | "updateGovernance"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "GovernanceUpdated" | "InstanceAdded"): EventFragment;
    encodeFunctionData(functionFragment: "addRollup", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "getCanonicalRollup", values?: undefined): string;
    encodeFunctionData(functionFragment: "getGovernance", values?: undefined): string;
    encodeFunctionData(functionFragment: "getRewardDistributor", values?: undefined): string;
    encodeFunctionData(functionFragment: "getRollup", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getVersion", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "numberOfVersions", values?: undefined): string;
    encodeFunctionData(functionFragment: "updateGovernance", values: [AddressLike]): string;
    decodeFunctionResult(functionFragment: "addRollup", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getCanonicalRollup", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getGovernance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRewardDistributor", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getRollup", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getVersion", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "numberOfVersions", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "updateGovernance", data: BytesLike): Result;
}
export declare namespace GovernanceUpdatedEvent {
    type InputTuple = [governance: AddressLike];
    type OutputTuple = [governance: string];
    interface OutputObject {
        governance: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace InstanceAddedEvent {
    type InputTuple = [instance: AddressLike, version: BigNumberish];
    type OutputTuple = [instance: string, version: bigint];
    interface OutputObject {
        instance: string;
        version: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IRegistry extends BaseContract {
    connect(runner?: ContractRunner | null): IRegistry;
    waitForDeployment(): Promise<this>;
    interface: IRegistryInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    addRollup: TypedContractMethod<[_rollup: AddressLike], [void], "nonpayable">;
    getCanonicalRollup: TypedContractMethod<[], [string], "view">;
    getGovernance: TypedContractMethod<[], [string], "view">;
    getRewardDistributor: TypedContractMethod<[], [string], "view">;
    getRollup: TypedContractMethod<[_chainId: BigNumberish], [string], "view">;
    getVersion: TypedContractMethod<[_index: BigNumberish], [bigint], "view">;
    numberOfVersions: TypedContractMethod<[], [bigint], "view">;
    updateGovernance: TypedContractMethod<[
        _governance: AddressLike
    ], [
        void
    ], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "addRollup"): TypedContractMethod<[_rollup: AddressLike], [void], "nonpayable">;
    getFunction(nameOrSignature: "getCanonicalRollup"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "getGovernance"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "getRewardDistributor"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "getRollup"): TypedContractMethod<[_chainId: BigNumberish], [string], "view">;
    getFunction(nameOrSignature: "getVersion"): TypedContractMethod<[_index: BigNumberish], [bigint], "view">;
    getFunction(nameOrSignature: "numberOfVersions"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "updateGovernance"): TypedContractMethod<[_governance: AddressLike], [void], "nonpayable">;
    getEvent(key: "GovernanceUpdated"): TypedContractEvent<GovernanceUpdatedEvent.InputTuple, GovernanceUpdatedEvent.OutputTuple, GovernanceUpdatedEvent.OutputObject>;
    getEvent(key: "InstanceAdded"): TypedContractEvent<InstanceAddedEvent.InputTuple, InstanceAddedEvent.OutputTuple, InstanceAddedEvent.OutputObject>;
    filters: {
        "GovernanceUpdated(address)": TypedContractEvent<GovernanceUpdatedEvent.InputTuple, GovernanceUpdatedEvent.OutputTuple, GovernanceUpdatedEvent.OutputObject>;
        GovernanceUpdated: TypedContractEvent<GovernanceUpdatedEvent.InputTuple, GovernanceUpdatedEvent.OutputTuple, GovernanceUpdatedEvent.OutputObject>;
        "InstanceAdded(address,uint256)": TypedContractEvent<InstanceAddedEvent.InputTuple, InstanceAddedEvent.OutputTuple, InstanceAddedEvent.OutputObject>;
        InstanceAdded: TypedContractEvent<InstanceAddedEvent.InputTuple, InstanceAddedEvent.OutputTuple, InstanceAddedEvent.OutputObject>;
    };
}
