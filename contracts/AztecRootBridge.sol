pragma solidity >=0.8.27;

import "./IRootBridge.sol";

import "@aztec/l1-contracts/src/core/interfaces/messagebridge/IInbox.sol"

contract AztecRootBridge is IRootBridge {
    // sends the new giga root to the L2
    function sendGigaRootToL2(bytes32 gigaRoot) external {
        // TODO:
    }

    // return the most recent root of the L2 to use in the construction of a new gigaRoot
    function getRoot() external returns (bytes32) {
        // TODO:
    }
}
