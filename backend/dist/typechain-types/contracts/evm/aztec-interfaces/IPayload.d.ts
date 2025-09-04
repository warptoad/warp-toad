import type { BaseContract, BytesLike, FunctionFragment, Result, Interface, AddressLike, ContractRunner, ContractMethod, Listener } from "ethers";
import type { TypedContractEvent, TypedDeferredTopicFilter, TypedEventLog, TypedListener, TypedContractMethod } from "../../../common";
export declare namespace IPayload {
    type ActionStruct = {
        target: AddressLike;
        data: BytesLike;
    };
    type ActionStructOutput = [target: string, data: string] & {
        target: string;
        data: string;
    };
}
export interface IPayloadInterface extends Interface {
    getFunction(nameOrSignature: "getActions"): FunctionFragment;
    encodeFunctionData(functionFragment: "getActions", values?: undefined): string;
    decodeFunctionResult(functionFragment: "getActions", data: BytesLike): Result;
}
export interface IPayload extends BaseContract {
    connect(runner?: ContractRunner | null): IPayload;
    waitForDeployment(): Promise<this>;
    interface: IPayloadInterface;
    queryFilter<TCEvent extends TypedContractEvent>(event: TCEvent, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    queryFilter<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TypedEventLog<TCEvent>>>;
    on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    on<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>;
    once<TCEvent extends TypedContractEvent>(filter: TypedDeferredTopicFilter<TCEvent>, listener: TypedListener<TCEvent>): Promise<this>;
    listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>;
    listeners(eventName?: string): Promise<Array<Listener>>;
    removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>;
    getActions: TypedContractMethod<[], [IPayload.ActionStructOutput[]], "view">;
    getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T;
    getFunction(nameOrSignature: "getActions"): TypedContractMethod<[], [IPayload.ActionStructOutput[]], "view">;
    filters: {};
}
