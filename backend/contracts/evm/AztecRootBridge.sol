// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import "./IRootBridge.sol";
import "hardhat/console.sol";

// Messaging
import {IRegistry} from "./aztec-interfaces/IRegistry.sol";
import {IInbox} from "./aztec-interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "./aztec-interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "./aztec-interfaces/IRollup.sol";
import {DataStructures} from "./aztec-interfaces/CoreDataStructures.sol";

// hash for message passing to L2
import {Hash} from "./aztec-interfaces/crypto/Hash.sol";

contract AztecRootBridge is IRootBridge {
    event newGigaRootSentToL2(bytes32 newGigaRoot, bytes32 key, uint256 index);
    event receivedNewL2Root(bytes32 newL2Root);

    IRegistry public registry;
    bytes32 public l2Bridge;
    uint32 public aztecChainId;
    bytes32 public mostRecentL2Root;

    IRollup public rollup;
    IOutbox public outbox;
    IInbox public inbox;
    uint256 public rollupVersion;

    /**
     * @notice Initialize the portal
     * @param _registry - The registry address
     * @param _l2Bridge - The L2 bridge address
     */
    // TODO: anyone can call this to set the l2 bridge to something else.  Should make it only callable once
    function initialize(address _registry, bytes32 _l2Bridge) external {
        registry = IRegistry(_registry);
        l2Bridge = _l2Bridge;

        rollup = IRollup(registry.getCanonicalRollup());
        outbox = rollup.getOutbox();
        inbox = rollup.getInbox();
        rollupVersion = rollup.getVersion();
        mostRecentL2Root = bytes32(0);
    }

    /**
     * @notice adds an L2 message which can only be consumed publicly on Aztec
     * @param _newGigaRoot - The new gigaRoot to send to L2 as a message.  It's actually supposed to be a secret hash but we don't care
     */
    function sendGigaRootToL2(bytes32 _newGigaRoot) external {
        console.log("actor");
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(
            l2Bridge,
            rollupVersion
        );

        console.log("sha256ToField");
        // Hash the message content to be reconstructed in the receiving contract
        bytes32 contentHash = Hash.sha256ToField(_newGigaRoot);

        console.log("sendL2Message");

        // we don't care about things being secret
        bytes32 secretHash = bytes32(0);
        // Send message to rollup
        (bytes32 key, uint256 index) = inbox.sendL2Message(
            actor,
            contentHash,
            secretHash
        );

        // Emit event
        emit newGigaRootSentToL2(_newGigaRoot, key, index);

        // would be easier to return the key and index but we can't assume this pattern is the same for all
        // bridges so this interface can't return anything
    }

    function getMostRecentRoot() external returns (bytes32) {
        return mostRecentL2Root;
    }

    /**
     * @notice gets the L2 root from the portal
     * @dev Second part of getting the L2 root to L1, must be initiated from L2 first as it will consume a message from outbox
     * @param _newL2Root - the merkle root currently on the L2 to add into the GigaRoot
     * @param _l2BlockNumber - The address to send the funds to
     * @param _leafIndex - The amount to withdraw
     * @param _path - Flag to use `msg.sender` as caller, otherwise address(0)
     * Must match the caller of the message (specified from L2) to consume it.
     */
    function refreshRoot(
        bytes32 _newL2Root,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external returns (bytes32) {
        DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
            sender: DataStructures.L2Actor(l2Bridge, 1),
            recipient: DataStructures.L1Actor(address(this), block.chainid),
            content: Hash.sha256ToField(_newL2Root)
        });

        IOutbox outbox = IRollup(registry.getRollup(aztecChainId)).getOutbox();

        outbox.consume(message, _l2BlockNumber, _leafIndex, _path);

        mostRecentL2Root = _newL2Root;

        emit receivedNewL2Root(_newL2Root);

        _newL2Root;
    }
}
