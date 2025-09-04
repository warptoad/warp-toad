import type { BaseContract, BigNumberish, BytesLike, FunctionFragment, Result, Interface, EventFragment, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedLogDescription, TypedListener, TypedContractMethod } from "../../../common";
export interface IGovernanceProposerInterface extends Interface {
    getFunction(nameOrSignature: "computeRound" | "executeProposal" | "getExecutor" | "getInstance" | "vote" | "yeaCount"): FunctionFragment;
    getEvent(nameOrSignatureOrTopic: "ProposalExecuted" | "VoteCast"): EventFragment;
    encodeFunctionData(functionFragment: "computeRound", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "executeProposal", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getExecutor", values?: undefined): string;
    encodeFunctionData(functionFragment: "getInstance", values?: undefined): string;
    encodeFunctionData(functionFragment: "vote", values: [AddressLike]): string;
    encodeFunctionData(functionFragment: "yeaCount", values: [AddressLike, BigNumberish, AddressLike]): string;
    decodeFunctionResult(functionFragment: "computeRound", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "executeProposal", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getExecutor", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getInstance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "vote", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "yeaCount", data: BytesLike): Result;
}
export declare namespace ProposalExecutedEvent {
    type InputTuple = [proposal: AddressLike, round: BigNumberish];
    type OutputTuple = [proposal: string, round: bigint];
    interface OutputObject {
        proposal: string;
        round: bigint;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export declare namespace VoteCastEvent {
    type InputTuple = [
        proposal: AddressLike,
        round: BigNumberish,
        voter: AddressLike
    ];
    type OutputTuple = [proposal: string, round: bigint, voter: string];
    interface OutputObject {
        proposal: string;
        round: bigint;
        voter: string;
    }
    type Event = TypedContractEvent<InputTuple, OutputTuple, OutputObject>;
    type Filter = TypedDeferredTopicFilter<Event>;
    type Log = TypedEventLog<Event>;
    type LogDescription = TypedLogDescription<Event>;
}
export interface IGovernanceProposer extends BaseContract {
    connect(runner?: ContractRunner | null): IGovernanceProposer;
    waitForDeployment(): Promise<this>;
    interface: IGovernanceProposerInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    computeRound: TypedContractMethod<[_slot: BigNumberish], [bigint], "view">;
    executeProposal: TypedContractMethod<[
        _roundNumber: BigNumberish
    ], [
        boolean
    ], "nonpayable">;
    getExecutor: TypedContractMethod<[], [string], "view">;
    getInstance: TypedContractMethod<[], [string], "view">;
    vote: TypedContractMethod<[_proposal: AddressLike], [boolean], "nonpayable">;
    yeaCount: TypedContractMethod<[
        _instance: AddressLike,
        _round: BigNumberish,
        _proposal: AddressLike
    ], [
        bigint
    ], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "computeRound"): TypedContractMethod<[_slot: BigNumberish], [bigint], "view">;
    getFunction(nameOrSignature: "executeProposal"): TypedContractMethod<[_roundNumber: BigNumberish], [boolean], "nonpayable">;
    getFunction(nameOrSignature: "getExecutor"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "getInstance"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "vote"): TypedContractMethod<[_proposal: AddressLike], [boolean], "nonpayable">;
    getFunction(nameOrSignature: "yeaCount"): TypedContractMethod<[
        _instance: AddressLike,
        _round: BigNumberish,
        _proposal: AddressLike
    ], [
        bigint
    ], "view">;
    getEvent(key: "ProposalExecuted"): TypedContractEvent<ProposalExecutedEvent.InputTuple, ProposalExecutedEvent.OutputTuple, ProposalExecutedEvent.OutputObject>;
    getEvent(key: "VoteCast"): TypedContractEvent<VoteCastEvent.InputTuple, VoteCastEvent.OutputTuple, VoteCastEvent.OutputObject>;
    filters: {
        "ProposalExecuted(address,uint256)": TypedContractEvent<ProposalExecutedEvent.InputTuple, ProposalExecutedEvent.OutputTuple, ProposalExecutedEvent.OutputObject>;
        ProposalExecuted: TypedContractEvent<ProposalExecutedEvent.InputTuple, ProposalExecutedEvent.OutputTuple, ProposalExecutedEvent.OutputObject>;
        "VoteCast(address,uint256,address)": TypedContractEvent<VoteCastEvent.InputTuple, VoteCastEvent.OutputTuple, VoteCastEvent.OutputObject>;
        VoteCast: TypedContractEvent<VoteCastEvent.InputTuple, VoteCastEvent.OutputTuple, VoteCastEvent.OutputObject>;
    };
}
