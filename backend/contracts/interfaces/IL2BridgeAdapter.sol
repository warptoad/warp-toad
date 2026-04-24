// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IL2BridgeAdapter {
    //TODO
    
    // gigaRoot is emitted as a bytes32 here because thats how it's recovered on the
    //  L2 side of this rootBridgeAdapter.  Key and index are also used to
    // retrieve this newGigaRoot on L2
    //event ReceivedNewL2Root(uint256 newL2Root, uint256 l2Block);

}