import type { BaseContract, BytesLike, FunctionFragment, Result, Interface, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedListener, TypedContractMethod } from "../../../common";
export interface WithdrawVerifierInterface extends Interface {
    getFunction(nameOrSignature: "getVerificationKeyHash" | "verify"): FunctionFragment;
    encodeFunctionData(functionFragment: "getVerificationKeyHash", values?: undefined): string;
    encodeFunctionData(functionFragment: "verify", values: [BytesLike, BytesLike[]]): string;
    decodeFunctionResult(functionFragment: "getVerificationKeyHash", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "verify", data: BytesLike): Result;
}
export interface WithdrawVerifier extends BaseContract {
    connect(runner?: ContractRunner | null): WithdrawVerifier;
    waitForDeployment(): Promise<this>;
    interface: WithdrawVerifierInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getVerificationKeyHash: TypedContractMethod<[], [string], "view">;
    verify: TypedContractMethod<[
        _proof: BytesLike,
        _publicInputs: BytesLike[]
    ], [
        boolean
    ], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "getVerificationKeyHash"): TypedContractMethod<[], [string], "view">;
    getFunction(nameOrSignature: "verify"): TypedContractMethod<[
        _proof: BytesLike,
        _publicInputs: BytesLike[]
    ], [
        boolean
    ], "view">;
    filters: {};
}
