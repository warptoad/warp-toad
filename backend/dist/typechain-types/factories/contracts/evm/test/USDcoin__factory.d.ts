import { ContractFactory, ContractTransactionResponse } from "ethers";
import type { Signer, ContractDeployTransaction, ContractRunner } from "ethers";
import type { NonPayableOverrides } from "../../../../common";
import type { USDcoin, USDcoinInterface } from "../../../../contracts/evm/test/USDcoin";
type USDcoinConstructorParams = [signer?: Signer] | ConstructorParameters<typeof ContractFactory>;
export declare class USDcoin__factory extends ContractFactory {
    constructor(...args: USDcoinConstructorParams);
    getDeployTransaction(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<ContractDeployTransaction>;
    deploy(overrides?: NonPayableOverrides & {
        from?: string;
    }): Promise<USDcoin & {
        deploymentTransaction(): ContractTransactionResponse;
    }>;
    connect(runner: ContractRunner | null): USDcoin__factory;
    static readonly bytecode = "0x608060405234801561000f575f5ffd5b50604051806040016040528060088152602001672aa9a21021b7b4b760c11b815250604051806040016040528060048152602001635553444360e01b815250816003908161005d919061010a565b50600461006a828261010a565b5050506101c4565b634e487b7160e01b5f52604160045260245ffd5b600181811c9082168061009a57607f821691505b6020821081036100b857634e487b7160e01b5f52602260045260245ffd5b50919050565b601f82111561010557805f5260205f20601f840160051c810160208510156100e35750805b601f840160051c820191505b81811015610102575f81556001016100ef565b50505b505050565b81516001600160401b0381111561012357610123610072565b610137816101318454610086565b846100be565b6020601f821160018114610169575f83156101525750848201515b5f19600385901b1c1916600184901b178455610102565b5f84815260208120601f198516915b828110156101985787850151825560209485019460019092019101610178565b50848210156101b557868401515f19600387901b60f8161c191681555b50505050600190811b01905550565b6107fb806101d15f395ff3fe608060405234801561000f575f5ffd5b50600436106100b9575f3560e01c8063313ce5671161007257806395d89b411161005857806395d89b411461016f578063a9059cbb14610177578063dd62ed3e1461018a575f5ffd5b8063313ce5671461013857806370a0823114610147575f5ffd5b80630c5312fc116100a25780630c5312fc146100fe57806318160ddd1461011357806323b872dd14610125575f5ffd5b806306fdde03146100bd578063095ea7b3146100db575b5f5ffd5b6100c56101c2565b6040516100d29190610654565b60405180910390f35b6100ee6100e93660046106a4565b610252565b60405190151581526020016100d2565b61011161010c3660046106cc565b61026b565b005b6002545b6040519081526020016100d2565b6100ee6101333660046106e3565b610278565b604051600681526020016100d2565b61011761015536600461071d565b6001600160a01b03165f9081526020819052604090205490565b6100c561029b565b6100ee6101853660046106a4565b6102aa565b61011761019836600461073d565b6001600160a01b039182165f90815260016020908152604080832093909416825291909152205490565b6060600380546101d19061076e565b80601f01602080910402602001604051908101604052809291908181526020018280546101fd9061076e565b80156102485780601f1061021f57610100808354040283529160200191610248565b820191905f5260205f20905b81548152906001019060200180831161022b57829003601f168201915b5050505050905090565b5f3361025f8185856102b7565b60019150505b92915050565b61027533826102c9565b50565b5f33610285858285610306565b61029085858561039b565b506001949350505050565b6060600480546101d19061076e565b5f3361025f81858561039b565b6102c48383836001610411565b505050565b6001600160a01b0382166102f75760405163ec442f0560e01b81525f60048201526024015b60405180910390fd5b6103025f8383610515565b5050565b6001600160a01b038381165f908152600160209081526040808320938616835292905220545f198110156103955781811015610387576040517ffb8f41b20000000000000000000000000000000000000000000000000000000081526001600160a01b038416600482015260248101829052604481018390526064016102ee565b61039584848484035f610411565b50505050565b6001600160a01b0383166103dd576040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081525f60048201526024016102ee565b6001600160a01b0382166104065760405163ec442f0560e01b81525f60048201526024016102ee565b6102c4838383610515565b6001600160a01b038416610453576040517fe602df050000000000000000000000000000000000000000000000000000000081525f60048201526024016102ee565b6001600160a01b038316610495576040517f94280d620000000000000000000000000000000000000000000000000000000081525f60048201526024016102ee565b6001600160a01b038085165f908152600160209081526040808320938716835292905220829055801561039557826001600160a01b0316846001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9258460405161050791815260200190565b60405180910390a350505050565b6001600160a01b03831661053f578060025f82825461053491906107a6565b909155506105c89050565b6001600160a01b0383165f90815260208190526040902054818110156105aa576040517fe450d38c0000000000000000000000000000000000000000000000000000000081526001600160a01b038516600482015260248101829052604481018390526064016102ee565b6001600160a01b0384165f9081526020819052604090209082900390555b6001600160a01b0382166105e457600280548290039055610602565b6001600160a01b0382165f9081526020819052604090208054820190555b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8360405161064791815260200190565b60405180910390a3505050565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b038116811461069f575f5ffd5b919050565b5f5f604083850312156106b5575f5ffd5b6106be83610689565b946020939093013593505050565b5f602082840312156106dc575f5ffd5b5035919050565b5f5f5f606084860312156106f5575f5ffd5b6106fe84610689565b925061070c60208501610689565b929592945050506040919091013590565b5f6020828403121561072d575f5ffd5b61073682610689565b9392505050565b5f5f6040838503121561074e575f5ffd5b61075783610689565b915061076560208401610689565b90509250929050565b600181811c9082168061078257607f821691505b6020821081036107a057634e487b7160e01b5f52602260045260245ffd5b50919050565b8082018082111561026557634e487b7160e01b5f52601160045260245ffdfea2646970667358221220c2bcc4732a4df0c49fda331d3166c75b12120bef559cf63bb7fc678c8db38b1764736f6c634300081d0033";
    static readonly abi: readonly [{
        readonly inputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "constructor";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "allowance";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "needed";
            readonly type: "uint256";
        }];
        readonly name: "ERC20InsufficientAllowance";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "sender";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "balance";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "needed";
            readonly type: "uint256";
        }];
        readonly name: "ERC20InsufficientBalance";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "approver";
            readonly type: "address";
        }];
        readonly name: "ERC20InvalidApprover";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "receiver";
            readonly type: "address";
        }];
        readonly name: "ERC20InvalidReceiver";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "sender";
            readonly type: "address";
        }];
        readonly name: "ERC20InvalidSender";
        readonly type: "error";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }];
        readonly name: "ERC20InvalidSpender";
        readonly type: "error";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "Approval";
        readonly type: "event";
    }, {
        readonly anonymous: false;
        readonly inputs: readonly [{
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "from";
            readonly type: "address";
        }, {
            readonly indexed: true;
            readonly internalType: "address";
            readonly name: "to";
            readonly type: "address";
        }, {
            readonly indexed: false;
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "Transfer";
        readonly type: "event";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }];
        readonly name: "allowance";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "spender";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "approve";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "balanceOf";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "decimals";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "";
            readonly type: "uint8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "_amount";
            readonly type: "uint256";
        }];
        readonly name: "getFreeShit";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "name";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "symbol";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "totalSupply";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "to";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "transfer";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "from";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "to";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "transferFrom";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): USDcoinInterface;
    static connect(address: string, runner?: ContractRunner | null): USDcoin;
}
export {};
