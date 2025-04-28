// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;
import "./IRootBridge.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";

contract GigaRootBridge {
	
	event constructedNewGigaRoot(bytes32 newGigaRoot);
	event receivedNewL2Root(bytes32 newL2Root, address rootBridge);

    address public wrapperToken;
    IRootBridge[] public rootBridges;
	// mapping of the rootBridge addr to their root's position in the the l2Roots array
    mapping(address => uint8) public rootBridgeL2RootsIndex;
	bytes32[] public l2Roots;
    bytes32 public gigaRoot;
	uint8 _maxTreeDepth;

    /**
     * @notice Initialize the root bridge
     * @param _bridgeAddresses - the L1 contracts that can receive roots from corresponding L2s
     */
    constructor(address[] memory _bridgeAddresses, uint8 _maxTreeDepth) {
        for (uint256 i = 0; i < _bridgeAddresses.length; i++) {
			address thisBridgeAddress = _bridgeAddresses[i];

			// add to list of rootBridges 
            rootBridges.push(IRootBridge(thisBridgeAddress));	

			// note the index of this root bridge in the array l2Roots
            rootBridgeL2RootsIndex[thisBridgeAddress] = i;

			// initialize the root as 0
			l2Roots[i] = 0;
        }

		maxTreeDepth = _maxTreeDepth;

		// gigaRoot starts as 0
        gigaRoot = 0;
    }

    /**
     * @notice updates the current gigaRoot by querying for updates from the supplied
     * list of L2 bridges.  You can pull updates from a subset of L2s for gas saving (don't have to update to all l2s).
     * Calls corresponding contracts to update the GigaRoots on the L2.
     */
    function updateRoot(address[] memory _bridgeAddresses) external {
		// change the necessary roots in l2Roots array
        for (uint256 i = 0; i < _bridgeAddresses.length; i++) {
			address thisBridgeAddress = _bridgeAddresses[i];

			// get the index of this bridge's root in the l2Roots array
			uint8 indexInL2Roots = rootBridgeL2RootsIndex[thisBridgeAddress];

            require(
				indexInL2Roots > 0,
                "address is not a registered root bridge address"
            );

            IRootBridge l2RootBridge = IRootBridge(thisBridgeAddress);

			// get the most recent l2 root from this bridge
            bytes32 newL2Root = l2RootBridge.getMostRecentRoot();
			emit receivedNewL2Root(newL2Root, thisBridgeAddress);

			// update the root in the corresponding index in the array
			l2Roots[indexInL2Roots] = newL2Root;	
        }

		bytes32 newGigaRoot = constructGigaRoot(l2Roots);

		// update all L2s with the new gigaRoot
		for (uint256 i = 0; i < rootBridges.length; i++) {
			IRootBridge thisRootBridge = rootBridges[i];

			// send the new gigaRoot to the L2's bridge
			thisRootBridge.sendGigaRootToL2(newGigaRoot);
		}
    }

	// gas optimization potential here for when we update a subset of roots
	function constructGigaRoot(bytes32[] _l2Roots) pure internal returns bytes32 {

		// Assumes arity of 2 (2 children per node)
		// TODO: base case of 1 root?
		bytes32[] hashes = _l2Roots;
		for (uint256 d = maxTreeDepth; d > 1; d--) {
			bytes32[] newHashes;	
			for (uint256 i = 1; i < hashes.length; i = i + 2) {
				bytes_32 left = _l2Roots[i-1];
				bytes_32 right = _l2Roots[i]

				bytes_32 hash = PoseidonT3.hash([left, right]);
				newHashes.push(hash);
			}	
			hashes = newHashes;
		}
		
		emit constructedNewGigaRoot(newGigaRoot);

		newGigaRoot;
	}
}
