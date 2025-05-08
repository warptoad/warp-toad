// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IGigaRootProvider {
    function sendGigaRoot(address _gigaRootRecipient) external;
    function gigaRoot() external returns(uint256);
}

interface IGigaRootRecipient {
    function receiveGigaRoot(uint256 _gigaRoot) external;
}

interface ILocalRootProvider {
    function getLocalRootAndBlock() external returns (uint256, uint256);
}

interface ILocalRootRecipient {
    //only gigaBridge does this
    //function updateGigaRoot(address[] memory _localRootProvider) external;
}
