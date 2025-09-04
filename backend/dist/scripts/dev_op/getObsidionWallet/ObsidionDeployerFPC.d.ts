import { AztecAddress, type AztecAddressLike, type ContractArtifact, ContractBase, ContractFunctionInteraction, type ContractMethod, type ContractStorageLayout, type ContractNotes, DeployMethod, type FieldLike, type FunctionSelectorLike, PublicKeys, type Wallet } from '@aztec/aztec.js';
export declare const ObsidionDeployerFPCContractArtifact: any;
/**
 * Type-safe interface for contract ObsidionDeployerFPC;
 */
export declare class ObsidionDeployerFPCContract extends ContractBase {
    private constructor();
    /**
     * Creates a contract instance.
     * @param address - The deployed contract's address.
     * @param wallet - The wallet to use when interacting with the contract.
     * @returns A promise that resolves to a new Contract instance.
     */
    static at(address: AztecAddress, wallet: Wallet): Promise<ObsidionDeployerFPCContract>;
    /**
     * Creates a tx to deploy a new instance of this contract.
     */
    static deploy(wallet: Wallet, signing_pub_key_x: FieldLike, signing_pub_key_y: FieldLike): DeployMethod<ObsidionDeployerFPCContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
     */
    static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, signing_pub_key_x: FieldLike, signing_pub_key_y: FieldLike): DeployMethod<ObsidionDeployerFPCContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified constructor method.
     */
    static deployWithOpts<M extends keyof ObsidionDeployerFPCContract['methods']>(opts: {
        publicKeys?: PublicKeys;
        method?: M;
        wallet: Wallet;
    }, ...args: Parameters<ObsidionDeployerFPCContract['methods'][M]>): DeployMethod<ObsidionDeployerFPCContract>;
    /**
     * Returns this contract's artifact.
     */
    static get artifact(): ContractArtifact;
    /**
     * Returns this contract's artifact with public bytecode.
     */
    static get artifactForPublic(): ContractArtifact;
    static get storage(): ContractStorageLayout<'signing_public_key'>;
    static get notes(): ContractNotes<'PublicKeyNote'>;
    /** Type-safe wrappers for the public methods exposed by the contract. */
    methods: {
        /** constructor(signing_pub_key_x: field, signing_pub_key_y: field) */
        constructor: ((signing_pub_key_x: FieldLike, signing_pub_key_y: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** entrypoint(app_payload: struct, fee_payload: struct, cancellable: boolean) */
        entrypoint: ((app_payload: {
            function_calls: {
                args_hash: FieldLike;
                function_selector: FunctionSelectorLike;
                target_address: AztecAddressLike;
                is_public: boolean;
                is_static: boolean;
            }[];
            nonce: FieldLike;
        }, fee_payload: {
            function_calls: {
                args_hash: FieldLike;
                function_selector: FunctionSelectorLike;
                target_address: AztecAddressLike;
                is_public: boolean;
                is_static: boolean;
            }[];
            nonce: FieldLike;
            is_fee_payer: boolean;
        }, cancellable: boolean) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** fee_entrypoint_private(max_fee: integer, nonce: field) */
        fee_entrypoint_private: ((max_fee: (bigint | number), nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** fee_entrypoint_public(max_fee: integer, nonce: field) */
        fee_entrypoint_public: ((max_fee: (bigint | number), nonce: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_accepted_asset() */
        get_accepted_asset: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** lookup_validity(consumer: struct, inner_hash: field) */
        lookup_validity: ((consumer: AztecAddressLike, inner_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_dispatch(selector: field) */
        public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** sync_notes() */
        sync_notes: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** verify_private_authwit(inner_hash: field) */
        verify_private_authwit: ((inner_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
    };
}
