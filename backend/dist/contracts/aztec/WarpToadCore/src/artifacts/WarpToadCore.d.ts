import { type AbiType, AztecAddress, type AztecAddressLike, type ContractArtifact, ContractBase, ContractFunctionInteraction, type ContractMethod, type ContractStorageLayout, type ContractNotes, DeployMethod, type EthAddressLike, EventSelector, type FieldLike, PublicKeys, type Wallet } from '@aztec/aztec.js';
export declare const WarpToadCoreContractArtifact: ContractArtifact;
export type Transfer = {
    from: AztecAddressLike;
    to: AztecAddressLike;
    amount: (bigint | number);
};
/**
 * Type-safe interface for contract WarpToadCore;
 */
export declare class WarpToadCoreContract extends ContractBase {
    private constructor();
    /**
     * Creates a contract instance.
     * @param address - The deployed contract's address.
     * @param wallet - The wallet to use when interacting with the contract.
     * @returns A promise that resolves to a new Contract instance.
     */
    static at(address: AztecAddress, wallet: Wallet): Promise<WarpToadCoreContract>;
    /**
     * Creates a tx to deploy a new instance of this contract.
     */
    static deploy(wallet: Wallet, native_token: EthAddressLike, _name: string, _symbol: string, _decimals: (bigint | number)): DeployMethod<WarpToadCoreContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified public keys hash to derive the address.
     */
    static deployWithPublicKeys(publicKeys: PublicKeys, wallet: Wallet, native_token: EthAddressLike, _name: string, _symbol: string, _decimals: (bigint | number)): DeployMethod<WarpToadCoreContract>;
    /**
     * Creates a tx to deploy a new instance of this contract using the specified constructor method.
     */
    static deployWithOpts<M extends keyof WarpToadCoreContract['methods']>(opts: {
        publicKeys?: PublicKeys;
        method?: M;
        wallet: Wallet;
    }, ...args: Parameters<WarpToadCoreContract['methods'][M]>): DeployMethod<WarpToadCoreContract>;
    /**
     * Returns this contract's artifact.
     */
    static get artifact(): ContractArtifact;
    /**
     * Returns this contract's artifact with public bytecode.
     */
    static get artifactForPublic(): ContractArtifact;
    static get storage(): ContractStorageLayout<'giga_root' | 'native_token' | 'balances' | 'commitments' | 'symbol' | 'name' | 'decimals' | 'deployer' | 'giga_root_provider' | 'l1_bridge_adapter'>;
    static get notes(): ContractNotes<'ValueNote' | 'UintNote' | 'WarpToadNote'>;
    /** Type-safe wrappers for the public methods exposed by the contract. */
    methods: {
        /** balance_of(owner: struct) */
        balance_of: ((owner: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** burn(amount: integer, destination_chain_id: field, secret: field, nullifier_preimage: field) */
        burn: ((amount: (bigint | number), destination_chain_id: FieldLike, secret: FieldLike, nullifier_preimage: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** constructor(native_token: struct, _name: string, _symbol: string, _decimals: integer) */
        constructor: ((native_token: EthAddressLike, _name: string, _symbol: string, _decimals: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_chain_id_unconstrained(aztec_version: field) */
        get_chain_id_unconstrained: ((aztec_version: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_decimals() */
        get_decimals: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_giga_root() */
        get_giga_root: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_l1_bridge_adapter() */
        get_l1_bridge_adapter: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_note_proof(block_number: integer, note_hash: field) */
        get_note_proof: ((block_number: (bigint | number), note_hash: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** get_version() */
        get_version: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** initialize(_giga_root_provider: struct, _l1_bridge_adapter: struct) */
        initialize: ((_giga_root_provider: AztecAddressLike, _l1_bridge_adapter: EthAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_for_testing(amount: integer, recipient: struct) */
        mint_for_testing: ((amount: (bigint | number), recipient: AztecAddressLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** mint_giga_root_evm(amount: integer, secret: field, nullifier_preimage: field, recipient: struct, block_number: integer, origin_local_root: field, giga_merkle_data: struct, evm_merkle_data: struct) */
        mint_giga_root_evm: ((amount: (bigint | number), secret: FieldLike, nullifier_preimage: FieldLike, recipient: AztecAddressLike, block_number: (bigint | number), origin_local_root: FieldLike, giga_merkle_data: {
            leaf_index: FieldLike;
            hash_path: FieldLike[];
        }, evm_merkle_data: {
            leaf_index: FieldLike;
            hash_path: FieldLike[];
        }) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** process_message(message_ciphertext: struct, message_context: struct) */
        process_message: ((message_ciphertext: FieldLike[], message_context: {
            tx_hash: FieldLike;
            unique_note_hashes_in_tx: FieldLike[];
            first_nullifier_in_tx: FieldLike;
            recipient: AztecAddressLike;
        }) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_dispatch(selector: field) */
        public_dispatch: ((selector: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_get_name() */
        public_get_name: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** public_get_symbol() */
        public_get_symbol: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** receive_giga_root(giga_root: field) */
        receive_giga_root: ((giga_root: FieldLike) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** sync_private_state() */
        sync_private_state: (() => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
        /** transfer(to: struct, amount: integer) */
        transfer: ((to: AztecAddressLike, amount: (bigint | number)) => ContractFunctionInteraction) & Pick<ContractMethod, 'selector'>;
    };
    static get events(): {
        Transfer: {
            abiType: AbiType;
            eventSelector: EventSelector;
            fieldNames: string[];
        };
    };
}
