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
}