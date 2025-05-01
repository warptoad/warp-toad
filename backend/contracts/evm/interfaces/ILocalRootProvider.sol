interface ILocalRootProvider {
    function receiveGigaRoot(uint256 _gigaRoot) external;
    function getLocalRootAndBlock() external returns (uint256, uint256);
}