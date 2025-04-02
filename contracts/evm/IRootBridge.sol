// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IRootBridge {
    // sends the new giga root to the L2
    function sendGigaRootToL2(bytes32 gigaRoot) external;

    // return the most recent root of the L2 to use in the construction of a new gigaRoot
    function getMostRecentRoot() external returns (bytes32);
}
