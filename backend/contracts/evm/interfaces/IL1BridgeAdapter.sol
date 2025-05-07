// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IL1BridgeAdapter {

    // gigaRoot is emitted as a bytes32 here because thats how it's recovered on the
    //  L2 side of this rootBridgeAdapter.  Key and index are also used to
    // retrieve this newGigaRoot on L2
    event ReceivedNewL2Root(uint256 newL2Root, uint256 l2Block);

    // /**
    //  * @notice adds an L2 message which can only be consumed publicly on L1
    //  * @param _newGigaRoot - The new gigaRoot to send to L2 as a message
    //  */
    // function receiveGigaRoot(
    //     uint256 _newGigaRoot
    // ) external;

    // function getLocalRootAndBlock() view external returns (uint256, uint256);
}
