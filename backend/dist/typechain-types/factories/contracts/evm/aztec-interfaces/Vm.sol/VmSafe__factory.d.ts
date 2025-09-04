import { type ContractRunner } from "ethers";
import type { VmSafe, VmSafeInterface } from "../../../../../contracts/evm/aztec-interfaces/Vm.sol/VmSafe";
export declare class VmSafe__factory {
    static readonly abi: readonly [{
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }];
        readonly name: "accesses";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "readSlots";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "writeSlots";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "addr";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "keyAddr";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqAbs";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqAbs";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqAbs";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqAbs";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqAbsDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqAbsDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqAbsDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqAbsDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqRel";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqRel";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqRel";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqRel";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqRelDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqRelDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertApproxEqRelDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "maxPercentDelta";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertApproxEqRelDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "left";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "right";
            readonly type: "bytes32[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "left";
            readonly type: "int256[]";
        }, {
            readonly internalType: "int256[]";
            readonly name: "right";
            readonly type: "int256[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "left";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "right";
            readonly type: "address";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "left";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "right";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "left";
            readonly type: "address[]";
        }, {
            readonly internalType: "address[]";
            readonly name: "right";
            readonly type: "address[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "left";
            readonly type: "address[]";
        }, {
            readonly internalType: "address[]";
            readonly name: "right";
            readonly type: "address[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "left";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "right";
            readonly type: "bool";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "left";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "right";
            readonly type: "address";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "left";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "right";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "left";
            readonly type: "bool[]";
        }, {
            readonly internalType: "bool[]";
            readonly name: "right";
            readonly type: "bool[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "left";
            readonly type: "int256[]";
        }, {
            readonly internalType: "int256[]";
            readonly name: "right";
            readonly type: "int256[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "left";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "right";
            readonly type: "bytes32";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "left";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "right";
            readonly type: "uint256[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "left";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes";
            readonly name: "right";
            readonly type: "bytes";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "left";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "right";
            readonly type: "bytes32";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "left";
            readonly type: "string[]";
        }, {
            readonly internalType: "string[]";
            readonly name: "right";
            readonly type: "string[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "left";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "right";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "left";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes";
            readonly name: "right";
            readonly type: "bytes";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "left";
            readonly type: "bool[]";
        }, {
            readonly internalType: "bool[]";
            readonly name: "right";
            readonly type: "bool[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "left";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "right";
            readonly type: "bytes[]";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "left";
            readonly type: "string[]";
        }, {
            readonly internalType: "string[]";
            readonly name: "right";
            readonly type: "string[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "left";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "right";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "left";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "right";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "left";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "right";
            readonly type: "bool";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "condition";
            readonly type: "bool";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertFalse";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "condition";
            readonly type: "bool";
        }];
        readonly name: "assertFalse";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertGe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertGe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertGeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertGeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertGt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertGt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertGtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertGtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertGtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertLe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertLe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLe";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertLeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertLeDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertLt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertLt";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertLtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertLtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertLtDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "left";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "right";
            readonly type: "bytes32[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "left";
            readonly type: "int256[]";
        }, {
            readonly internalType: "int256[]";
            readonly name: "right";
            readonly type: "int256[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "left";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "right";
            readonly type: "bool";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "left";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "right";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "left";
            readonly type: "bool";
        }, {
            readonly internalType: "bool";
            readonly name: "right";
            readonly type: "bool";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "left";
            readonly type: "bool[]";
        }, {
            readonly internalType: "bool[]";
            readonly name: "right";
            readonly type: "bool[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "left";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes";
            readonly name: "right";
            readonly type: "bytes";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "left";
            readonly type: "address[]";
        }, {
            readonly internalType: "address[]";
            readonly name: "right";
            readonly type: "address[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "left";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "right";
            readonly type: "uint256[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "left";
            readonly type: "bool[]";
        }, {
            readonly internalType: "bool[]";
            readonly name: "right";
            readonly type: "bool[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "left";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "right";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "left";
            readonly type: "address[]";
        }, {
            readonly internalType: "address[]";
            readonly name: "right";
            readonly type: "address[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "left";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "right";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "left";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "right";
            readonly type: "address";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "left";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "right";
            readonly type: "bytes32";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "left";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes";
            readonly name: "right";
            readonly type: "bytes";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "left";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "right";
            readonly type: "uint256[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "left";
            readonly type: "address";
        }, {
            readonly internalType: "address";
            readonly name: "right";
            readonly type: "address";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "left";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "right";
            readonly type: "bytes32";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "left";
            readonly type: "string[]";
        }, {
            readonly internalType: "string[]";
            readonly name: "right";
            readonly type: "string[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "left";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "right";
            readonly type: "bytes32[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "left";
            readonly type: "string[]";
        }, {
            readonly internalType: "string[]";
            readonly name: "right";
            readonly type: "string[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "left";
            readonly type: "int256[]";
        }, {
            readonly internalType: "int256[]";
            readonly name: "right";
            readonly type: "int256[]";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "left";
            readonly type: "bytes[]";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "right";
            readonly type: "bytes[]";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }];
        readonly name: "assertNotEq";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertNotEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "left";
            readonly type: "int256";
        }, {
            readonly internalType: "int256";
            readonly name: "right";
            readonly type: "int256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }];
        readonly name: "assertNotEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "left";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "right";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "decimals";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertNotEqDecimal";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "condition";
            readonly type: "bool";
        }];
        readonly name: "assertTrue";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "condition";
            readonly type: "bool";
        }, {
            readonly internalType: "string";
            readonly name: "error";
            readonly type: "string";
        }];
        readonly name: "assertTrue";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "condition";
            readonly type: "bool";
        }];
        readonly name: "assume";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "assumeNoRevert";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "reverter";
                readonly type: "address";
            }, {
                readonly internalType: "bool";
                readonly name: "partialMatch";
                readonly type: "bool";
            }, {
                readonly internalType: "bytes";
                readonly name: "revertData";
                readonly type: "bytes";
            }];
            readonly internalType: "struct VmSafe.PotentialRevert[]";
            readonly name: "potentialReverts";
            readonly type: "tuple[]";
        }];
        readonly name: "assumeNoRevert";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "reverter";
                readonly type: "address";
            }, {
                readonly internalType: "bool";
                readonly name: "partialMatch";
                readonly type: "bool";
            }, {
                readonly internalType: "bytes";
                readonly name: "revertData";
                readonly type: "bytes";
            }];
            readonly internalType: "struct VmSafe.PotentialRevert";
            readonly name: "potentialRevert";
            readonly type: "tuple";
        }];
        readonly name: "assumeNoRevert";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "implementation";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.SignedDelegation";
            readonly name: "signedDelegation";
            readonly type: "tuple";
        }];
        readonly name: "attachDelegation";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "char";
            readonly type: "string";
        }];
        readonly name: "breakpoint";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "char";
            readonly type: "string";
        }, {
            readonly internalType: "bool";
            readonly name: "value";
            readonly type: "bool";
        }];
        readonly name: "breakpoint";
        readonly outputs: readonly [];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "broadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }];
        readonly name: "broadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "broadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly name: "broadcastRawTransaction";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "closeFile";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "initCodeHash";
            readonly type: "bytes32";
        }];
        readonly name: "computeCreate2Address";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "initCodeHash";
            readonly type: "bytes32";
        }, {
            readonly internalType: "address";
            readonly name: "deployer";
            readonly type: "address";
        }];
        readonly name: "computeCreate2Address";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployer";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "nonce";
            readonly type: "uint256";
        }];
        readonly name: "computeCreateAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "subject";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "search";
            readonly type: "string";
        }];
        readonly name: "contains";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "from";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "to";
            readonly type: "string";
        }];
        readonly name: "copyFile";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "copied";
            readonly type: "uint64";
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
        }];
        readonly name: "copyStorage";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "bool";
            readonly name: "recursive";
            readonly type: "bool";
        }];
        readonly name: "createDir";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "walletLabel";
            readonly type: "string";
        }];
        readonly name: "createWallet";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "createWallet";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "string";
            readonly name: "walletLabel";
            readonly type: "string";
        }];
        readonly name: "createWallet";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "constructorArgs";
            readonly type: "bytes";
        }, {
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "constructorArgs";
            readonly type: "bytes";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "constructorArgs";
            readonly type: "bytes";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "salt";
            readonly type: "bytes32";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "constructorArgs";
            readonly type: "bytes";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "deployCode";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "derivationPath";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "index";
            readonly type: "uint32";
        }, {
            readonly internalType: "string";
            readonly name: "language";
            readonly type: "string";
        }];
        readonly name: "deriveKey";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "index";
            readonly type: "uint32";
        }, {
            readonly internalType: "string";
            readonly name: "language";
            readonly type: "string";
        }];
        readonly name: "deriveKey";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "index";
            readonly type: "uint32";
        }];
        readonly name: "deriveKey";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "derivationPath";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "index";
            readonly type: "uint32";
        }];
        readonly name: "deriveKey";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "ensNamehash";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "value";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envAddress";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "value";
            readonly type: "address[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envBool";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "value";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envBool";
        readonly outputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "value";
            readonly type: "bool[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "value";
            readonly type: "bytes[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envBytes32";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "value";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envBytes32";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envExists";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envInt";
        readonly outputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "value";
            readonly type: "int256[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "value";
            readonly type: "int256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "defaultValue";
            readonly type: "bytes32[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "value";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "int256[]";
            readonly name: "defaultValue";
            readonly type: "int256[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "value";
            readonly type: "int256[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "bool";
            readonly name: "defaultValue";
            readonly type: "bool";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "value";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "address";
            readonly name: "defaultValue";
            readonly type: "address";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "value";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "uint256";
            readonly name: "defaultValue";
            readonly type: "uint256";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "defaultValue";
            readonly type: "bytes[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "value";
            readonly type: "bytes[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "defaultValue";
            readonly type: "uint256[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "value";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "string[]";
            readonly name: "defaultValue";
            readonly type: "string[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "value";
            readonly type: "string[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "defaultValue";
            readonly type: "bytes";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "bytes32";
            readonly name: "defaultValue";
            readonly type: "bytes32";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "int256";
            readonly name: "defaultValue";
            readonly type: "int256";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "value";
            readonly type: "int256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "address[]";
            readonly name: "defaultValue";
            readonly type: "address[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "value";
            readonly type: "address[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "defaultValue";
            readonly type: "string";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "value";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }, {
            readonly internalType: "bool[]";
            readonly name: "defaultValue";
            readonly type: "bool[]";
        }];
        readonly name: "envOr";
        readonly outputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "value";
            readonly type: "bool[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envString";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "value";
            readonly type: "string[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "value";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }];
        readonly name: "envUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delim";
            readonly type: "string";
        }];
        readonly name: "envUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "value";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "fromBlock";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "toBlock";
            readonly type: "uint256";
        }, {
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "topics";
            readonly type: "bytes32[]";
        }];
        readonly name: "eth_getLogs";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "emitter";
                readonly type: "address";
            }, {
                readonly internalType: "bytes32[]";
                readonly name: "topics";
                readonly type: "bytes32[]";
            }, {
                readonly internalType: "bytes";
                readonly name: "data";
                readonly type: "bytes";
            }, {
                readonly internalType: "bytes32";
                readonly name: "blockHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "blockNumber";
                readonly type: "uint64";
            }, {
                readonly internalType: "bytes32";
                readonly name: "transactionHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "transactionIndex";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint256";
                readonly name: "logIndex";
                readonly type: "uint256";
            }, {
                readonly internalType: "bool";
                readonly name: "removed";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.EthGetLogs[]";
            readonly name: "logs";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "exists";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "commandInput";
            readonly type: "string[]";
        }];
        readonly name: "ffi";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "result";
            readonly type: "bytes";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "version";
            readonly type: "string";
        }];
        readonly name: "foundryVersionAtLeast";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "version";
            readonly type: "string";
        }];
        readonly name: "foundryVersionCmp";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "";
            readonly type: "int256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "fsMetadata";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bool";
                readonly name: "isDir";
                readonly type: "bool";
            }, {
                readonly internalType: "bool";
                readonly name: "isSymlink";
                readonly type: "bool";
            }, {
                readonly internalType: "uint256";
                readonly name: "length";
                readonly type: "uint256";
            }, {
                readonly internalType: "bool";
                readonly name: "readOnly";
                readonly type: "bool";
            }, {
                readonly internalType: "uint256";
                readonly name: "modified";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "accessed";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "created";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.FsMetadata";
            readonly name: "metadata";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "code";
            readonly type: "bytes";
        }];
        readonly name: "getArtifactPathByCode";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "deployedCode";
            readonly type: "bytes";
        }];
        readonly name: "getArtifactPathByDeployedCode";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getBlobBaseFee";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "blobBaseFee";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getBlockNumber";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "height";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getBlockTimestamp";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "timestamp";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "chainId";
            readonly type: "uint64";
        }, {
            readonly internalType: "enum VmSafe.BroadcastTxType";
            readonly name: "txType";
            readonly type: "uint8";
        }];
        readonly name: "getBroadcast";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "txHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "enum VmSafe.BroadcastTxType";
                readonly name: "txType";
                readonly type: "uint8";
            }, {
                readonly internalType: "address";
                readonly name: "contractAddress";
                readonly type: "address";
            }, {
                readonly internalType: "uint64";
                readonly name: "blockNumber";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "success";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.BroadcastTxSummary";
            readonly name: "";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "chainId";
            readonly type: "uint64";
        }];
        readonly name: "getBroadcasts";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "txHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "enum VmSafe.BroadcastTxType";
                readonly name: "txType";
                readonly type: "uint8";
            }, {
                readonly internalType: "address";
                readonly name: "contractAddress";
                readonly type: "address";
            }, {
                readonly internalType: "uint64";
                readonly name: "blockNumber";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "success";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.BroadcastTxSummary[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "chainId";
            readonly type: "uint64";
        }, {
            readonly internalType: "enum VmSafe.BroadcastTxType";
            readonly name: "txType";
            readonly type: "uint8";
        }];
        readonly name: "getBroadcasts";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32";
                readonly name: "txHash";
                readonly type: "bytes32";
            }, {
                readonly internalType: "enum VmSafe.BroadcastTxType";
                readonly name: "txType";
                readonly type: "uint8";
            }, {
                readonly internalType: "address";
                readonly name: "contractAddress";
                readonly type: "address";
            }, {
                readonly internalType: "uint64";
                readonly name: "blockNumber";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "success";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.BroadcastTxSummary[]";
            readonly name: "";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }];
        readonly name: "getCode";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "creationBytecode";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "artifactPath";
            readonly type: "string";
        }];
        readonly name: "getDeployedCode";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "runtimeBytecode";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "chainId";
            readonly type: "uint64";
        }];
        readonly name: "getDeployment";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }];
        readonly name: "getDeployment";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "deployedAddress";
            readonly type: "address";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "contractName";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "chainId";
            readonly type: "uint64";
        }];
        readonly name: "getDeployments";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "deployedAddresses";
            readonly type: "address[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getFoundryVersion";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "version";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "getLabel";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "currentLabel";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "elementSlot";
            readonly type: "bytes32";
        }];
        readonly name: "getMappingKeyAndParentOf";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "found";
            readonly type: "bool";
        }, {
            readonly internalType: "bytes32";
            readonly name: "key";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "parent";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "mappingSlot";
            readonly type: "bytes32";
        }];
        readonly name: "getMappingLength";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "length";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "mappingSlot";
            readonly type: "bytes32";
        }, {
            readonly internalType: "uint256";
            readonly name: "idx";
            readonly type: "uint256";
        }];
        readonly name: "getMappingSlotAt";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }];
        readonly name: "getNonce";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "nonce";
            readonly type: "uint64";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }];
        readonly name: "getNonce";
        readonly outputs: readonly [{
            readonly internalType: "uint64";
            readonly name: "nonce";
            readonly type: "uint64";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getRecordedLogs";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "bytes32[]";
                readonly name: "topics";
                readonly type: "bytes32[]";
            }, {
                readonly internalType: "bytes";
                readonly name: "data";
                readonly type: "bytes";
            }, {
                readonly internalType: "address";
                readonly name: "emitter";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.Log[]";
            readonly name: "logs";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getStateDiff";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "diff";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getStateDiffJson";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "diff";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "getWallets";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "wallets";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "indexOf";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "enum VmSafe.ForgeContext";
            readonly name: "context";
            readonly type: "uint8";
        }];
        readonly name: "isContext";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "isDir";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "isFile";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "result";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "keyExists";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "keyExistsJson";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "keyExistsToml";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "account";
            readonly type: "address";
        }, {
            readonly internalType: "string";
            readonly name: "newLabel";
            readonly type: "string";
        }];
        readonly name: "label";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "lastCallGas";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint64";
                readonly name: "gasLimit";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "gasTotalUsed";
                readonly type: "uint64";
            }, {
                readonly internalType: "uint64";
                readonly name: "gasMemoryUsed";
                readonly type: "uint64";
            }, {
                readonly internalType: "int64";
                readonly name: "gasRefunded";
                readonly type: "int64";
            }, {
                readonly internalType: "uint64";
                readonly name: "gasRemaining";
                readonly type: "uint64";
            }];
            readonly internalType: "struct VmSafe.Gas";
            readonly name: "gas";
            readonly type: "tuple";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "slot";
            readonly type: "bytes32";
        }];
        readonly name: "load";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "data";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "parsedValue";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseBool";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "parsedValue";
            readonly type: "bool";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "parsedValue";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseBytes32";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "parsedValue";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "parsedValue";
            readonly type: "int256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly name: "parseJson";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "abiEncodedData";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJson";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "abiEncodedData";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonAddressArray";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBool";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBoolArray";
        readonly outputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "";
            readonly type: "bool[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBytes32";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBytes32Array";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonBytesArray";
        readonly outputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "";
            readonly type: "bytes[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "";
            readonly type: "int256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonIntArray";
        readonly outputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "";
            readonly type: "int256[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonKeys";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "keys";
            readonly type: "string[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonStringArray";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "";
            readonly type: "string[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseJsonType";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseJsonType";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseJsonTypeArray";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseJsonUintArray";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseToml";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "abiEncodedData";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }];
        readonly name: "parseToml";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "abiEncodedData";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlAddressArray";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "";
            readonly type: "address[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBool";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBoolArray";
        readonly outputs: readonly [{
            readonly internalType: "bool[]";
            readonly name: "";
            readonly type: "bool[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBytes32";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBytes32Array";
        readonly outputs: readonly [{
            readonly internalType: "bytes32[]";
            readonly name: "";
            readonly type: "bytes32[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlBytesArray";
        readonly outputs: readonly [{
            readonly internalType: "bytes[]";
            readonly name: "";
            readonly type: "bytes[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "";
            readonly type: "int256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlIntArray";
        readonly outputs: readonly [{
            readonly internalType: "int256[]";
            readonly name: "";
            readonly type: "int256[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlKeys";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "keys";
            readonly type: "string[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlStringArray";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "";
            readonly type: "string[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseTomlType";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseTomlType";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }];
        readonly name: "parseTomlTypeArray";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "toml";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "key";
            readonly type: "string";
        }];
        readonly name: "parseTomlUintArray";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly name: "parseUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "parsedValue";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "pauseGasMetering";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "pauseTracing";
        readonly outputs: readonly [];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "projectRoot";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "promptText";
            readonly type: "string";
        }];
        readonly name: "prompt";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "promptText";
            readonly type: "string";
        }];
        readonly name: "promptAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "promptText";
            readonly type: "string";
        }];
        readonly name: "promptSecret";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "promptText";
            readonly type: "string";
        }];
        readonly name: "promptSecretUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "promptText";
            readonly type: "string";
        }];
        readonly name: "promptUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "publicKeyP256";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "publicKeyX";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "publicKeyY";
            readonly type: "uint256";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomAddress";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomBool";
        readonly outputs: readonly [{
            readonly internalType: "bool";
            readonly name: "";
            readonly type: "bool";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "len";
            readonly type: "uint256";
        }];
        readonly name: "randomBytes";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomBytes4";
        readonly outputs: readonly [{
            readonly internalType: "bytes4";
            readonly name: "";
            readonly type: "bytes4";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomBytes8";
        readonly outputs: readonly [{
            readonly internalType: "bytes8";
            readonly name: "";
            readonly type: "bytes8";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "";
            readonly type: "int256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "bits";
            readonly type: "uint256";
        }];
        readonly name: "randomInt";
        readonly outputs: readonly [{
            readonly internalType: "int256";
            readonly name: "";
            readonly type: "int256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "randomUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "bits";
            readonly type: "uint256";
        }];
        readonly name: "randomUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "min";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint256";
            readonly name: "max";
            readonly type: "uint256";
        }];
        readonly name: "randomUint";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "";
            readonly type: "uint256";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "maxDepth";
            readonly type: "uint64";
        }];
        readonly name: "readDir";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "string";
                readonly name: "errorMessage";
                readonly type: "string";
            }, {
                readonly internalType: "string";
                readonly name: "path";
                readonly type: "string";
            }, {
                readonly internalType: "uint64";
                readonly name: "depth";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "isDir";
                readonly type: "bool";
            }, {
                readonly internalType: "bool";
                readonly name: "isSymlink";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.DirEntry[]";
            readonly name: "entries";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "uint64";
            readonly name: "maxDepth";
            readonly type: "uint64";
        }, {
            readonly internalType: "bool";
            readonly name: "followLinks";
            readonly type: "bool";
        }];
        readonly name: "readDir";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "string";
                readonly name: "errorMessage";
                readonly type: "string";
            }, {
                readonly internalType: "string";
                readonly name: "path";
                readonly type: "string";
            }, {
                readonly internalType: "uint64";
                readonly name: "depth";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "isDir";
                readonly type: "bool";
            }, {
                readonly internalType: "bool";
                readonly name: "isSymlink";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.DirEntry[]";
            readonly name: "entries";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "readDir";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "string";
                readonly name: "errorMessage";
                readonly type: "string";
            }, {
                readonly internalType: "string";
                readonly name: "path";
                readonly type: "string";
            }, {
                readonly internalType: "uint64";
                readonly name: "depth";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "isDir";
                readonly type: "bool";
            }, {
                readonly internalType: "bool";
                readonly name: "isSymlink";
                readonly type: "bool";
            }];
            readonly internalType: "struct VmSafe.DirEntry[]";
            readonly name: "entries";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "readFile";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "data";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "readFileBinary";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "readLine";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "line";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "linkPath";
            readonly type: "string";
        }];
        readonly name: "readLink";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "targetPath";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "record";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "recordLogs";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "rememberKey";
        readonly outputs: readonly [{
            readonly internalType: "address";
            readonly name: "keyAddr";
            readonly type: "address";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "derivationPath";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "count";
            readonly type: "uint32";
        }];
        readonly name: "rememberKeys";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "keyAddrs";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "mnemonic";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "derivationPath";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "language";
            readonly type: "string";
        }, {
            readonly internalType: "uint32";
            readonly name: "count";
            readonly type: "uint32";
        }];
        readonly name: "rememberKeys";
        readonly outputs: readonly [{
            readonly internalType: "address[]";
            readonly name: "keyAddrs";
            readonly type: "address[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "bool";
            readonly name: "recursive";
            readonly type: "bool";
        }];
        readonly name: "removeDir";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "removeFile";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "from";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "to";
            readonly type: "string";
        }];
        readonly name: "replace";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "output";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "resetGasMetering";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "resumeGasMetering";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "resumeTracing";
        readonly outputs: readonly [];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "urlOrAlias";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "method";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "params";
            readonly type: "string";
        }];
        readonly name: "rpc";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "method";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "params";
            readonly type: "string";
        }];
        readonly name: "rpc";
        readonly outputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "rpcAlias";
            readonly type: "string";
        }];
        readonly name: "rpcUrl";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "rpcUrlStructs";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "string";
                readonly name: "key";
                readonly type: "string";
            }, {
                readonly internalType: "string";
                readonly name: "url";
                readonly type: "string";
            }];
            readonly internalType: "struct VmSafe.Rpc[]";
            readonly name: "urls";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "rpcUrls";
        readonly outputs: readonly [{
            readonly internalType: "string[2][]";
            readonly name: "urls";
            readonly type: "string[2][]";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "address[]";
            readonly name: "values";
            readonly type: "address[]";
        }];
        readonly name: "serializeAddress";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "address";
            readonly name: "value";
            readonly type: "address";
        }];
        readonly name: "serializeAddress";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bool[]";
            readonly name: "values";
            readonly type: "bool[]";
        }];
        readonly name: "serializeBool";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bool";
            readonly name: "value";
            readonly type: "bool";
        }];
        readonly name: "serializeBool";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bytes[]";
            readonly name: "values";
            readonly type: "bytes[]";
        }];
        readonly name: "serializeBytes";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly name: "serializeBytes";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bytes32[]";
            readonly name: "values";
            readonly type: "bytes32[]";
        }];
        readonly name: "serializeBytes32";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }];
        readonly name: "serializeBytes32";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "int256";
            readonly name: "value";
            readonly type: "int256";
        }];
        readonly name: "serializeInt";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "int256[]";
            readonly name: "values";
            readonly type: "int256[]";
        }];
        readonly name: "serializeInt";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "value";
            readonly type: "string";
        }];
        readonly name: "serializeJson";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly name: "serializeJsonType";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "typeDescription";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly name: "serializeJsonType";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "string[]";
            readonly name: "values";
            readonly type: "string[]";
        }];
        readonly name: "serializeString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "value";
            readonly type: "string";
        }];
        readonly name: "serializeString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "serializeUint";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "uint256[]";
            readonly name: "values";
            readonly type: "uint256[]";
        }];
        readonly name: "serializeUint";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "objectKey";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }, {
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "serializeUintToHex";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }, {
            readonly internalType: "bool";
            readonly name: "overwrite";
            readonly type: "bool";
        }];
        readonly name: "setArbitraryStorage";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "target";
            readonly type: "address";
        }];
        readonly name: "setArbitraryStorage";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "value";
            readonly type: "string";
        }];
        readonly name: "setEnv";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "array";
            readonly type: "uint256[]";
        }];
        readonly name: "shuffle";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "sign";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "v";
            readonly type: "uint8";
        }, {
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "s";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "sign";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "v";
            readonly type: "uint8";
        }, {
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "s";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "sign";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "v";
            readonly type: "uint8";
        }, {
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "s";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "sign";
        readonly outputs: readonly [{
            readonly internalType: "uint8";
            readonly name: "v";
            readonly type: "uint8";
        }, {
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "s";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "implementation";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "signAndAttachDelegation";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "implementation";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.SignedDelegation";
            readonly name: "signedDelegation";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "implementation";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint64";
            readonly name: "nonce";
            readonly type: "uint64";
        }];
        readonly name: "signAndAttachDelegation";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "implementation";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.SignedDelegation";
            readonly name: "signedDelegation";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "address";
                readonly name: "addr";
                readonly type: "address";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyX";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "publicKeyY";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "privateKey";
                readonly type: "uint256";
            }];
            readonly internalType: "struct VmSafe.Wallet";
            readonly name: "wallet";
            readonly type: "tuple";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "signCompact";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "vs";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "signCompact";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "vs";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "signCompact";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "vs";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "signCompact";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "vs";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "implementation";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "signDelegation";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "implementation";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.SignedDelegation";
            readonly name: "signedDelegation";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "implementation";
            readonly type: "address";
        }, {
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "uint64";
            readonly name: "nonce";
            readonly type: "uint64";
        }];
        readonly name: "signDelegation";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint8";
                readonly name: "v";
                readonly type: "uint8";
            }, {
                readonly internalType: "bytes32";
                readonly name: "r";
                readonly type: "bytes32";
            }, {
                readonly internalType: "bytes32";
                readonly name: "s";
                readonly type: "bytes32";
            }, {
                readonly internalType: "uint64";
                readonly name: "nonce";
                readonly type: "uint64";
            }, {
                readonly internalType: "address";
                readonly name: "implementation";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.SignedDelegation";
            readonly name: "signedDelegation";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }, {
            readonly internalType: "bytes32";
            readonly name: "digest";
            readonly type: "bytes32";
        }];
        readonly name: "signP256";
        readonly outputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "r";
            readonly type: "bytes32";
        }, {
            readonly internalType: "bytes32";
            readonly name: "s";
            readonly type: "bytes32";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "duration";
            readonly type: "uint256";
        }];
        readonly name: "sleep";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "array";
            readonly type: "uint256[]";
        }];
        readonly name: "sort";
        readonly outputs: readonly [{
            readonly internalType: "uint256[]";
            readonly name: "";
            readonly type: "uint256[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "delimiter";
            readonly type: "string";
        }];
        readonly name: "split";
        readonly outputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "outputs";
            readonly type: "string[]";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "startBroadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "signer";
            readonly type: "address";
        }];
        readonly name: "startBroadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "privateKey";
            readonly type: "uint256";
        }];
        readonly name: "startBroadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "startDebugTraceRecording";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "startMappingRecording";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "startStateDiffRecording";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "stopAndReturnDebugTraceRecording";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "uint256[]";
                readonly name: "stack";
                readonly type: "uint256[]";
            }, {
                readonly internalType: "bytes";
                readonly name: "memoryInput";
                readonly type: "bytes";
            }, {
                readonly internalType: "uint8";
                readonly name: "opcode";
                readonly type: "uint8";
            }, {
                readonly internalType: "uint64";
                readonly name: "depth";
                readonly type: "uint64";
            }, {
                readonly internalType: "bool";
                readonly name: "isOutOfGas";
                readonly type: "bool";
            }, {
                readonly internalType: "address";
                readonly name: "contractAddr";
                readonly type: "address";
            }];
            readonly internalType: "struct VmSafe.DebugStep[]";
            readonly name: "step";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "stopAndReturnStateDiff";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly components: readonly [{
                    readonly internalType: "uint256";
                    readonly name: "forkId";
                    readonly type: "uint256";
                }, {
                    readonly internalType: "uint256";
                    readonly name: "chainId";
                    readonly type: "uint256";
                }];
                readonly internalType: "struct VmSafe.ChainInfo";
                readonly name: "chainInfo";
                readonly type: "tuple";
            }, {
                readonly internalType: "enum VmSafe.AccountAccessKind";
                readonly name: "kind";
                readonly type: "uint8";
            }, {
                readonly internalType: "address";
                readonly name: "account";
                readonly type: "address";
            }, {
                readonly internalType: "address";
                readonly name: "accessor";
                readonly type: "address";
            }, {
                readonly internalType: "bool";
                readonly name: "initialized";
                readonly type: "bool";
            }, {
                readonly internalType: "uint256";
                readonly name: "oldBalance";
                readonly type: "uint256";
            }, {
                readonly internalType: "uint256";
                readonly name: "newBalance";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "deployedCode";
                readonly type: "bytes";
            }, {
                readonly internalType: "uint256";
                readonly name: "value";
                readonly type: "uint256";
            }, {
                readonly internalType: "bytes";
                readonly name: "data";
                readonly type: "bytes";
            }, {
                readonly internalType: "bool";
                readonly name: "reverted";
                readonly type: "bool";
            }, {
                readonly components: readonly [{
                    readonly internalType: "address";
                    readonly name: "account";
                    readonly type: "address";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "slot";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bool";
                    readonly name: "isWrite";
                    readonly type: "bool";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "previousValue";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bytes32";
                    readonly name: "newValue";
                    readonly type: "bytes32";
                }, {
                    readonly internalType: "bool";
                    readonly name: "reverted";
                    readonly type: "bool";
                }];
                readonly internalType: "struct VmSafe.StorageAccess[]";
                readonly name: "storageAccesses";
                readonly type: "tuple[]";
            }, {
                readonly internalType: "uint64";
                readonly name: "depth";
                readonly type: "uint64";
            }];
            readonly internalType: "struct VmSafe.AccountAccess[]";
            readonly name: "accountAccesses";
            readonly type: "tuple[]";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "stopBroadcast";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "stopMappingRecording";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "data";
            readonly type: "string";
        }];
        readonly name: "toBase64";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly name: "toBase64";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "data";
            readonly type: "string";
        }];
        readonly name: "toBase64URL";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly name: "toBase64URL";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }];
        readonly name: "toLowercase";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "output";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "address";
            readonly name: "value";
            readonly type: "address";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "value";
            readonly type: "uint256";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes";
            readonly name: "value";
            readonly type: "bytes";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bool";
            readonly name: "value";
            readonly type: "bool";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "int256";
            readonly name: "value";
            readonly type: "int256";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "bytes32";
            readonly name: "value";
            readonly type: "bytes32";
        }];
        readonly name: "toString";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "stringifiedValue";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }];
        readonly name: "toUppercase";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "output";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "input";
            readonly type: "string";
        }];
        readonly name: "trim";
        readonly outputs: readonly [{
            readonly internalType: "string";
            readonly name: "output";
            readonly type: "string";
        }];
        readonly stateMutability: "pure";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string[]";
            readonly name: "commandInput";
            readonly type: "string[]";
        }];
        readonly name: "tryFfi";
        readonly outputs: readonly [{
            readonly components: readonly [{
                readonly internalType: "int32";
                readonly name: "exitCode";
                readonly type: "int32";
            }, {
                readonly internalType: "bytes";
                readonly name: "stdout";
                readonly type: "bytes";
            }, {
                readonly internalType: "bytes";
                readonly name: "stderr";
                readonly type: "bytes";
            }];
            readonly internalType: "struct VmSafe.FfiResult";
            readonly name: "result";
            readonly type: "tuple";
        }];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [];
        readonly name: "unixTime";
        readonly outputs: readonly [{
            readonly internalType: "uint256";
            readonly name: "milliseconds";
            readonly type: "uint256";
        }];
        readonly stateMutability: "view";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "data";
            readonly type: "string";
        }];
        readonly name: "writeFile";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "bytes";
            readonly name: "data";
            readonly type: "bytes";
        }];
        readonly name: "writeFileBinary";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }];
        readonly name: "writeJson";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "writeJson";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "data";
            readonly type: "string";
        }];
        readonly name: "writeLine";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "valueKey";
            readonly type: "string";
        }];
        readonly name: "writeToml";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }, {
        readonly inputs: readonly [{
            readonly internalType: "string";
            readonly name: "json";
            readonly type: "string";
        }, {
            readonly internalType: "string";
            readonly name: "path";
            readonly type: "string";
        }];
        readonly name: "writeToml";
        readonly outputs: readonly [];
        readonly stateMutability: "nonpayable";
        readonly type: "function";
    }];
    static createInterface(): VmSafeInterface;
    static connect(address: string, runner?: ContractRunner | null): VmSafe;
}
