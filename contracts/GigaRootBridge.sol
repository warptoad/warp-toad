pragma solidity >=0.8.27;

import "./IRootBridge.sol";

contract GigaRootBridge {
    // TODO: gigaRootHistory
    address public wrapperToken;
    IRootBridge[] public rootBridges;
    mapping(address => bool) public isRootBridge;
    bytes32 public gigaRoot;

    /**
     * @notice Initialize the root bridge
     * @param _bridgeAddresses - the L1 contracts that can receive roots from corresponding L2s
     */
    function initialize(address[] memory _bridgeAddresses) external {
        for (uint256 i = 0; i < _bridgeAddresses.length; i++) {
            rootBridges.push(IRootBridge(_bridgeAddresses[i]));
            isRootBridge[_bridgeAddresses[i]] = true;
        }
        gigaRoot = 0;
    }

    /**
     * @notice updates the current gigaRoot by querying for updates from the supplied
     * list of L2 bridges.  You can pull updates from a subset of L2s for gas saving (don't have to update to all l2s).
     * Calls corresponding contracts to update the GigaRoots on the L2.
     *
     */
    function update_root(address[] memory _bridgeAddresses) external {
        for (uint256 i = 0; i < _bridgeAddresses.length; i++) {
            require(
                isRootBridge[_bridgeAddresses[i]],
                "address is not a registered root bridge address"
            );
            IRootBridge l2RootBridge = IRootBridge(_bridgeAddresses[i]);

            bytes32 newL2Root = l2RootBridge.getRoot();
            // TODO: merkle stuff to add this new root to construct the new gigaRoot
            bytes32 newGigaRoot = 0;

            // set the newly updated gigaRoot
            gigaRoot = newGigaRoot;

            l2RootBridge.sendGigaRootToL2(newGigaRoot);
        }
    }
}
