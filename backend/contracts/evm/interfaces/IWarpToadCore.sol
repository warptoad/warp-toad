// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;


interface IWarpToadCore {
    event Burn(uint256 indexed commitment, uint256 amount, uint256 index);
    function initialize(address _gigaRootProvider, address _l1BridgeAdapter) external;
    function isValidGigaRoot(uint256 _gigaRoot) external view returns (bool);
    function burn(uint256 _preCommitment, uint256 _amount) external;

    // our tree is lazy so we 
    function storeLocalRootInHistory() external returns(uint256);

    function _formatPublicInputs(        
        uint256 _nullifier,
        uint256 _chainId,
        uint256 _amount,
        uint256 _gigaRoot,
        uint256 _localRoot,
        uint256 _feeFactor,
        uint256 _priorityFee,
        uint256 _maxFee,
        address _relayer,
        address _recipient
    ) external pure returns (bytes32[] memory);


    // TODO relayer support
    function mint(
        uint256 _nullifier,
        uint256 _amount,
        uint256 _gigaRoot,
        uint256 _localRoot,
        uint256 _feeFactor,
        uint256 _priorityFee,
        uint256 _maxFee,
        address _relayer,
        address _recipient,
        bytes memory _poof
    ) external;

    function localRoot() external view returns (uint256);
    function isValidLocalRoot(uint256 _localRoot) external view returns (bool);

    // gigaRootProvider can call directly since are on the L1 already and don't need adapter
    // IGigaRootRecipient and ILocalRootProvider
//     function receiveGigaRoot(uint256 _gigaRoot) external;
//     function getLocalRootAndBlock() external returns (uint256, uint256);
}