// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IL1RootBridgeAdapter {
    // sends the new giga root to L1 side of a L2's root bridge adapter
    function sendGigaRootToAdapter(uint256 _gigaRoot) external;

    // return the most recent root of the L2 and the L2 block number it came from
    // used in construction of the gigaRoot
    function getMostRecentRootAndL2Block() external returns (uint256, uint32);

    // Function to receive the most recent root from the L2 adapter is left up to each
    // implementation.  The above functions are the minimum needed for GigaRootBridge.sol
}
