// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

/**
 * Minimal vendored ZK Stack (zkSync Era / Abstract / any Elastic Chain) interfaces.
 *
 * Vendored rather than pulled from `@matterlabs/zksync-contracts` on purpose: that
 * package drags in a large source tree, and Hardhat 3 has two known failure modes in
 * this repo with scoped npm Solidity packages (missing artifacts from npmFilesToBuild,
 * and missing userSourceNameMap entries that break `ignition verify`). The Aztec
 * interfaces under contracts/interfaces/aztec/ are vendored for the same reason.
 *
 * Only the four things the adapters actually touch are declared here.
 */

/// @dev Argument bundle for an L1->L2 request on an ETH-based chain.
struct L2TransactionRequestDirect {
    uint256 chainId;
    uint256 mintValue;
    address l2Contract;
    uint256 l2Value;
    bytes l2Calldata;
    uint256 l2GasLimit;
    uint256 l2GasPerPubdataByteLimit;
    bytes[] factoryDeps;
    address refundRecipient;
}

/// @dev An L2->L1 log payload as reconstructed on L1 for inclusion proving.
///      `sender` is whoever called L1Messenger.sendToL1 on L2 (no aliasing applies
///      in this direction) and `data` is the opaque blob they passed.
struct L2Message {
    uint16 txNumberInBatch;
    address sender;
    bytes data;
}

interface IBridgehub {
    /// @notice Enqueue an L1->L2 transaction. Requires msg.value == _request.mintValue
    ///         on ETH-based chains. Surplus mintValue is refunded to
    ///         `refundRecipient` *on L2*, not on L1.
    function requestL2TransactionDirect(
        L2TransactionRequestDirect calldata _request
    ) external payable returns (bytes32 canonicalTxHash);

    /// @notice Price of an L1->L2 transaction, denominated in the chain's base token.
    /// @dev The Bridgehub re-derives this from `tx.gasprice` at execution time, so the
    ///      only safe caller-side pattern is to read it with `tx.gasprice` in the same
    ///      transaction that spends it. See L1ZkStackBridgeAdapter._bridgeGigaRootToL2.
    function l2TransactionBaseCost(
        uint256 _chainId,
        uint256 _gasPrice,
        uint256 _l2GasLimit,
        uint256 _l2GasPerPubdataByteLimit
    ) external view returns (uint256);

    /// @notice Chain-agnostic inclusion check. Preferred over the per-chain diamond's
    ///         Mailbox.proveL2MessageInclusion so that one L1 adapter deployment can
    ///         serve several ZK Stack chains. Verified working against Era Sepolia.
    function proveL2MessageInclusion(
        uint256 _chainId,
        uint256 _batchNumber,
        uint256 _index,
        L2Message calldata _message,
        bytes32[] calldata _proof
    ) external view returns (bool);
}

interface IL1Messenger {
    /// @notice L2-side system contract at 0x...8008. Emits an opaque message keyed by
    ///         msg.sender. There is no target and no calldata: nothing is ever called
    ///         on L1, someone must pull the proof and submit it.
    function sendToL1(bytes calldata _message) external returns (bytes32);
}

/**
 * @dev L1->L2 aliasing. Applied by the protocol to every L1 *contract* sender; EOAs
 *      are passed through unchanged. This is the ZK Stack replacement for Scroll's
 *      `xDomainMessageSender()`, which does not exist here.
 */
library AddressAliasHelper {
    uint160 private constant OFFSET = uint160(0x1111000000000000000000000000000000001111);

    function applyL1ToL2Alias(address _l1Address) internal pure returns (address l2Address) {
        unchecked {
            l2Address = address(uint160(_l1Address) + OFFSET);
        }
    }

    function undoL1ToL2Alias(address _l2Address) internal pure returns (address l1Address) {
        unchecked {
            l1Address = address(uint160(_l2Address) - OFFSET);
        }
    }
}
