import { AztecAddress, type AztecAddressLike, type ContractArtifact, ContractBase, ContractFunctionInteraction, type ContractMethod, type ContractStorageLayout, type ContractNotes, DeployMethod, type EthAddressLike, type FieldLike, PublicKeys, type Wallet } from '@aztec/aztec.js';
export declare const L2AztecBridgeAdapterContractArtifact: any;
/**
 * Type-safe interface for contract L2AztecBridgeAdapter;
 */
export declare class L2AztecBridgeAdapterContract extends ContractBase {
    private constructor();
    /**
     * Creates a contract instance.
     * @param address - The deployed contract's address.
     * @param wallet - The wallet to use when interacting with the contract.
     * @returns A promise that resolves to a new Contract instance.
     */
    static at(address: AztecAddress, wallet: Wallet): Promise<L2AztecBridgeAdapterContract>;
    /**
     * Creates a tx to deploy a new instance of this contract.
     */
    static deploy(wallet: Wallet, l1BridgeAdapter: EthAddressLike): DeployMethod<L2AztecBridgeAdapterContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
     */
    static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, l1BridgeAdapter: EthAddressLike): DeployMethod<L2AztecBridgeAdapterContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified constructor method.
     */
    static deployWithOpts<M extends keyof L2AztecBridgeAdapterContract['methods']>(opts: {
        publicKeys?: PublicKeys;
        method?: M;
        wallet: Wallet;
    }, ...args: Parameters<L2AztecBridgeAdapterContract['methods'][M]>): DeployMethod<L2AztecBridgeAdapterContract>;
    /**
     * Returns this contract's artifact.
     */
    static get artifact(): ContractArtifact;
    /**
     * Returns this contract's artifact with public bytecode.
     */
    static get artifactForPublic(): ContractArtifact;
    static get storage(): ContractStorageLayout<'l1BridgeAdapter' | 'counter'>;
    static get notes(): ContractNotes<'ValueNote' | 'UintNote' | 'WarpToadNote'>;
    /** Type-safe wrappers for the public methods exposed by the contract. */
    methods: {
        /** constructor(l1BridgeAdapter: struct) */
        constructor: ((l1BridgeAdapter: EthAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** count(new_count: field) */
        count: ((new_count: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_l1BridgeAdapter_public() */
        get_l1BridgeAdapter_public: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** process_message(message_ciphertext: struct, message_context: struct) */
        process_message: ((message_ciphertext: FieldLike[], message_context: {
            tx_hash: FieldLike;
            unique_note_hashes_in_tx: FieldLike[];
            first_nullifier_in_tx: FieldLike;
            recipient: AztecAddressLike;
        }) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_dispatch(selector: field) */
        public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** receive_giga_root(new_gigaroot: field, message_leaf_index: field, warpToadCore: struct) */
        receive_giga_root: ((new_gigaroot: FieldLike, message_leaf_index: FieldLike, warpToadCore: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** send_root_to_l1(block_number: integer) */
        send_root_to_l1: ((block_number: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** sync_private_state() */
        sync_private_state: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
    };
}
