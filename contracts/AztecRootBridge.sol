pragma solidity >=0.8.27;

import "./IRootBridge.sol";

// Messaging
import {IRegistry} from "@aztec/l1-contracts/src/governance/interfaces/IRegistry.sol";
import {IInbox} from "@aztec/l1-contracts/src/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/l1-contracts/src/core/interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "@aztec/l1-contracts/src/core/interfaces/IRollup.sol";
import {DataStructures} from "@aztec/l1-contracts/src/core/libraries/DataStructures.sol";

// hash for message passing to L2
import {Hash} from "@aztec/l1-contracts/src/core/libraries/crypto/Hash.sol";

contract AztecRootBridge is IRootBridge {
    /**
     * @notice Initialize the portal
     * @param _registry - The registry address
     * @param _l2Bridge - The L2 bridge address
     */
    // docs:start:init
    function initialize(address _registry, bytes32 _l2Bridge) external {
        registry = IRegistry(_registry);
        l2Bridge = _l2Bridge;
    }

    /**
     * @notice Deposit funds into the portal and adds an L2 message which can only be consumed publicly on Aztec
     * @param newGigaRoot - The new gigaRoot to send to L2 as a message
     * @param _secretHash - The hash of the secret consumable message. The hash should be 254 bits (so it can fit in a Field element) (we don't care about this being secret)
     * @return The key of the entry in the Inbox and its leaf index
     */
    // TODO: we should use _secretHash as a parameter to hide when the value is consumed on the
    // L2 but for a hackathon we're assuming an altruistic actor who will pay gas to update roots
    function sendGigaRootToL2(bytes32 newGigaRoot) external {
        // Preamble
        IInbox inbox = IRollup(registry.getRollup()).getInbox();
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(
            l2Bridge,
            1
        );

        // Hash the message content to be reconstructed in the receiving contract
        bytes32 contentHash = Hash.sha256ToField(newGigaRoot);

        // Send message to rollup
        (bytes32 key, uint256 index) = inbox.sendL2Message(
            actor,
            contentHash,
            newGigaRoot
        );

        // Emit event
        emit DepositToAztecPublic(_to, _amount, _secretHash, key, index);

        // TODO: would it be easier to return key & index?
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
    function getRoot(
        bytes32 _newL2Root,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external returns bytes32 {
        DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
            sender: DataStructures.L2Actor(l2Bridge, 1),
            recipient: DataStructures.L1Actor(address(this), block.chainid),
            content: Hash.sha256ToField(_newL2Root)
        });

        IOutbox outbox = IRollup(registry.getRollup()).getOutbox();

        outbox.consume(message, _l2BlockNumber, _leafIndex, _path);

		_newL2Root
    }
}
