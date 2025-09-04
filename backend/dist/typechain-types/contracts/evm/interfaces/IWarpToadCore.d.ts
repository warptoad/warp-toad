import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface IWarpToadCoreInterface extends Interface {
    getFunction(nameOrSignature: "_formatPublicInputs" | "burn" | "initialize" | "isValidGigaRoot" | "isValidLocalRoot" | "localRoot" | "mint" | "storeLocalRootInHistory"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "Burn"): EventFragment;
    encodeFunctionData(functionFragment: "_formatPublicInputs", values: [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        AddressLike,
        AddressLike
    ]): string;
    encodeFunctionData(functionFragment: "burn", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "initialize", values: [AddressLike, AddressLike]): string;
    encodeFunctionData(functionFragment: "isValidGigaRoot", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "isValidLocalRoot", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "localRoot", values?: undefined): string;
    encodeFunctionData(functionFragment: "mint", values: [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        AddressLike,
        AddressLike,
        BytesLike
    ]): string;
    encodeFunctionData(functionFragment: "storeLocalRootInHistory", values?: undefined): string;
    decodeFunctionResult(functionFragment: "_formatPublicInputs", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "burn", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isValidGigaRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isValidLocalRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "localRoot", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "mint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "storeLocalRootInHistory", data: BytesLike): Result;
}
export declare namespace BurnEvent {
    type InputTuple = [
        commitment: BigNumberish,
        amount: BigNumberish,
        index: BigNumberish
    ];
    type OutputTuple = [commitment: bigint, amount: bigint, index: bigint];
    interface OutputObject {
        commitment: bigint;
        amount: bigint;
        index: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IWarpToadCore extends BaseContract {
    connect(runner?: ContractRunner | null): IWarpToadCore;
    waitForDeployment(): Promise<this>;
    interface: IWarpToadCoreInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    _formatPublicInputs: TypedContractMethod<[
        _nullifier: BigNumberish,
        _chainId: BigNumberish,
        _amount: BigNumberish,
        _gigaRoot: BigNumberish,
        _localRoot: BigNumberish,
        _feeFactor: BigNumberish,
        _priorityFee: BigNumberish,
        _maxFee: BigNumberish,
        _relayer: AddressLike,
        _recipient: AddressLike
    ], [
        string[]
    ], "view">;
    burn: TypedContractMethod<[
        _preCommitment: BigNumberish,
        _amount: BigNumberish
    ], [
        void
    ], "nonpayable">;
    initialize: TypedContractMethod<[
        _gigaRootProvider: AddressLike,
        _l1BridgeAdapter: AddressLike
    ], [
        void
    ], "nonpayable">;
    isValidGigaRoot: TypedContractMethod<[
        _gigaRoot: BigNumberish
    ], [
        boolean
    ], "view">;
    isValidLocalRoot: TypedContractMethod<[
        _localRoot: BigNumberish
    ], [
        boolean
    ], "view">;
    localRoot: TypedContractMethod<[], [bigint], "view">;
    mint: TypedContractMethod<[
        _nullifier: BigNumberish,
        _amount: BigNumberish,
        _gigaRoot: BigNumberish,
        _localRoot: BigNumberish,
        _feeFactor: BigNumberish,
        _priorityFee: BigNumberish,
        _maxFee: BigNumberish,
        _relayer: AddressLike,
        _recipient: AddressLike,
        _poof: BytesLike
    ], [
        void
    ], "nonpayable">;
    storeLocalRootInHistory: TypedContractMethod<[], [bigint], "nonpayable">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "_formatPublicInputs"): TypedContractMethod<[
        _nullifier: BigNumberish,
        _chainId: BigNumberish,
        _amount: BigNumberish,
        _gigaRoot: BigNumberish,
        _localRoot: BigNumberish,
        _feeFactor: BigNumberish,
        _priorityFee: BigNumberish,
        _maxFee: BigNumberish,
        _relayer: AddressLike,
        _recipient: AddressLike
    ], [
        string[]
    ], "view">;
    getFunction(nameOrSignature: "burn"): TypedContractMethod<[
        _preCommitment: BigNumberish,
        _amount: BigNumberish
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "initialize"): TypedContractMethod<[
        _gigaRootProvider: AddressLike,
        _l1BridgeAdapter: AddressLike
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "isValidGigaRoot"): TypedContractMethod<[_gigaRoot: BigNumberish], [boolean], "view">;
    getFunction(nameOrSignature: "isValidLocalRoot"): TypedContractMethod<[_localRoot: BigNumberish], [boolean], "view">;
    getFunction(nameOrSignature: "localRoot"): TypedContractMethod<[], [bigint], "view">;
    getFunction(nameOrSignature: "mint"): TypedContractMethod<[
        _nullifier: BigNumberish,
        _amount: BigNumberish,
        _gigaRoot: BigNumberish,
        _localRoot: BigNumberish,
        _feeFactor: BigNumberish,
        _priorityFee: BigNumberish,
        _maxFee: BigNumberish,
        _relayer: AddressLike,
        _recipient: AddressLike,
        _poof: BytesLike
    ], [
        void
    ], "nonpayable">;
    getFunction(nameOrSignature: "storeLocalRootInHistory"): TypedContractMethod<[], [bigint], "nonpayable">;
    getEvent(key: "Burn"): TypedContractEvent<BurnEvent.InputTuple, BurnEvent.OutputTuple, BurnEvent.OutputObject>;
    filters: {
        "Burn(uint256,uint256,uint256)": TypedContractEvent<BurnEvent.InputTuple, BurnEvent.OutputTuple, BurnEvent.OutputObject>;
        Burn: TypedContractEvent<BurnEvent.InputTuple, BurnEvent.OutputTuple, BurnEvent.OutputObject>;
    };
}
