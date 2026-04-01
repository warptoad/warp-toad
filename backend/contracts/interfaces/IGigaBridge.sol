// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

// TODO public state vars?
interface IGigaBridge {
    event ConstructedNewGigaRoot(
        uint256 indexed newGigaRoot
    ); 
    
    event ReceivedNewLocalRoot(
        uint256 indexed newLocalRoot,
        uint40 indexed localRootIndex, 
        uint256 localRootBlockNumber
    );

    function getLocalRootProvidersIndex(address _localRootProvider) external view returns(uint40);

    function isLocalRootProviders(address _localRootProvider) external view returns(bool);

    function updateGigaRoot(address[] memory _localRootProvider) external;

    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating their localRoot.
    // since most of the time everyone wants the latest gigaRoot but not everyone has a localRoot that is new
    // Sends the most recent gigaRoot to an array of localRootProviders
    function sendGigaRoot(address[] memory _gigaRootRecipients, uint256[] memory _amounts) payable external;

}