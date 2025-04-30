// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import "./IL1RootBridgeAdapter.sol";

// TODO: remove
// import "hardhat/console.sol";

// Messaging
import {IRegistry} from "./aztec-interfaces/IRegistry.sol";
import {IInbox} from "./aztec-interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "./aztec-interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "./aztec-interfaces/IRollup.sol";
import {DataStructures} from "./aztec-interfaces/CoreDataStructures.sol";

// hash for message passing to L2
import {Hash} from "./aztec-interfaces/crypto/Hash.sol";

// TODO: make it IRootBridge
//is IRootBridge
contract AztecRootBridge {
    // gigaRoot is emitted as a bytes32 here because thats how it's recovered on the
    // aztec L2 side of this rootBridgeAdapter.  Key and index are also used to
    // retrieve this newGigaRoot on aztec
    event newGigaRootSentToL2(bytes32 newGigaRoot, bytes32 key, uint256 index);
    event receivedNewL2Root(uint256 newL2Root, uint32 l2Block);

    IRegistry public registry;
    bytes32 public l2Bridge;
    uint32 public aztecChainId;
    uint256 public mostRecentL2Root;
    // the L2 block that the most recent L2 root came from
    uint32 public mostRecentL2RootBlockNumber;

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
        mostRecentL2Root = 0;
    }

    /**
     * @notice adds an L2 message which can only be consumed publicly on Aztec
     * @param _newGigaRoot - The new gigaRoot to send to L2 as a message
     */
    function sendGigaRootToL2(uint256 _newGigaRoot) external {
        // l2Bridge is the Aztec address of the contract that will be retrieving the
        // message on the L2
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(
            l2Bridge,
            rollupVersion
        );

        // Aztec docs assume that the message being passed is larger than a Field element
        // so it recommends you hash it and verify the hash on the L2 when retrieving the message.
        // Luckily for us, the GigaRoot is the size of a Field so we don't have to hash it
        // and can directly retrieve it on the L2.
        bytes32 contentHash = bytes32(_newGigaRoot);

        // `secret` is used to make the consumption of a message on the L2 private.
        // we don't care about keeping message consumption private at all so to
        // simplify things we hardcode the secret as 0 in the noir side and hardcode
        // Hash(0) here in the L1
        bytes32 secretHash = 0x001dc7b0244cb71a4609d526300ba6771064bd046848666f7bfe577053d630c5;

        // Send message to rollup
        (bytes32 key, uint256 index) = inbox.sendL2Message(
            actor,
            contentHash,
            secretHash
        );

        // Emit event
        emit newGigaRootSentToL2(contentHash, key, index);
    }

    function getMostRecentRoot() external view returns (uint256) {
        require(
            mostRecentL2Root > 0,
            "An L2 root hasn't yet been bridged to this contract. refreshRoot must be called."
        );
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
        uint32 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external returns (uint256) {
        // TODO: new data structure to extract
        DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
            sender: DataStructures.L2Actor(l2Bridge, rollupVersion),
            recipient: DataStructures.L1Actor(address(this), block.chainid),
            content: _newL2Root
        });

        outbox.consume(message, _l2BlockNumber, _leafIndex, _path);

        // convert from bytes32 to uint256
        uint256 newL2RootCast = uint256(_newL2Root);

        emit receivedNewL2Root(newL2RootCast, _l2BlockNumber);

        newL2RootCast;
    }
}
