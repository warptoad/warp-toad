// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;
import {ILocalRootProvider} from "./ILocalRootProvider.sol";
import {IGigaRootRecipient} from "./IGigaRootRecipient.sol";

// kinda gross to inherit yet again another thing but both interface have getLocalRootAndBlock and getLocalRootAndBlock
interface IL1BridgeAdapter is ILocalRootProvider, IGigaRootRecipient {

    // gigaRoot is emitted as a bytes32 here because thats how it's recovered on the
    //  L2 side of this rootBridgeAdapter.  Key and index are also used to
    // retrieve this newGigaRoot on L2
    event NewGigaRootSentToL2(bytes32 indexed newGigaRoot, bytes32 key, uint256 index); //newGigaRoot is also the content hash! wow!
    event ReceivedNewL2Root(uint256 newL2Root, uint256 l2Block);
    /**
     * @notice Initialize the portal
     * @param _registry - The registry address
     * @param _l2BridgeAdapter - The L2 bridge address
     */
    function initialize(
        address _registry,
        bytes32 _l2BridgeAdapter,
        address _gigaRootBridge
    ) external;

    /**
     * @notice adds an L2 message which can only be consumed publicly on L1
     * @param _newGigaRoot - The new gigaRoot to send to L2 as a message
     */
    function receiveGigaRoot(
        uint256 _newGigaRoot
    ) external;

    function getLocalRootAndBlock() view external returns (uint256, uint256);

    /**
     * @notice gets the L2 root from the portal
     * @dev Second part of getting the L2 root to L1, must be initiated from L2 first as it will consume a message from outbox
     * @param _newL2Root - the merkle root currently on the L2 to add into the GigaRoot
     * @param _bridgedL2BlockNumber - the block number that is in the content hash (should exactly match the block _newL2Root is from)
     * @param _witnessL2BlockNumber - the block number where we retrieve the message proof from (should exactly match the block at which the witness (aka _path) is retrieved )
     * @param _leafIndex - The amount to withdraw
     * @param _path - Must match the caller of the message (specified from L2) to consume it.
     */
    function getNewRootFromL2(
        bytes32 _newL2Root,
        uint256 _bridgedL2BlockNumber,
        uint256 _witnessL2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external;

    function getContentHash(
        bytes32 _newL2Root,
        uint256 _bridgedL2BlockNumber
    ) external pure returns (bytes32);
}
