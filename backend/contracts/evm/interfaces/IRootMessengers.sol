// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

interface IGigaRootProvider {
    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating their localRoot.
    // since most of the time everyone wants the latest gigaRoot but not everyone has a localRoot that is new
    // Sends the most recent gigaRoot to an array of localRootProviders
    function sendGigaRoot(address[] memory _gigaRootRecipients) external;
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
