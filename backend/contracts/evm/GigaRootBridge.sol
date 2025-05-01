// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;
import {ILocalRootProvider} from "./interfaces/ILocalRootProvider.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LazyIMT, LazyIMTData} from "@zk-kit/lazy-imt.sol/LazyIMT.sol";

contract GigaRootBridge {
    event constructedNewGigaRoot(uint256 indexed newGigaRoot);

    event receivedNewLocalRoot(
        uint256 indexed newLocalRoot,
        // block number that this root came from
        uint256 indexed localRootBlockNumber,
        address indexed LocalRootProvider
    );

    LazyIMTData public rootTreeData; // does this need to be public?
    ILocalRootProvider[] public localRootProviders;
    // just a membership mapping
    mapping(address => bool) isLocalRootProvider;
    // mapping of the LocalRootProvider addr to their local root's position in all
    // the arrays used (rootTreeData, localRootBlockNumbers, and localRootProviders)
    mapping(address => uint40) public localRootLeafIndexes;
    // mapping gigaRoot => block number of the local block each local root (leaf) came from
    // The length of the array is always localRootProviders.length
    mapping(uint256 => uint256[]) public localRootBlockNumbers;
    uint8 public maxTreeDepth;
    uint256 public gigaRoot;

    /**
     * @notice Initialize the root bridge
     * @param _localRootProviders - the L1 contracts that can receive roots from corresponding locals
     */
    constructor(address[] memory _localRootProviders, uint8 _maxTreeDepth) {
        maxTreeDepth = _maxTreeDepth;
        // init doesn't add any leaves
        LazyIMT.init(rootTreeData, _maxTreeDepth);

        // for each L1LocalRootProvider...
        for (uint40 i = 0; i < _localRootProviders.length; i++) {
            address thisLocalRootProvider = _localRootProviders[i];

            // add to list of rootBridges
            localRootProviders.push(
                ILocalRootProvider(thisLocalRootProvider)
            );

            // note the index of this root bridge.  This index will be used to in
            // rootTreeData, localRootBlockNumbers, and localRootProviders to keep a
            // "state" for each local which WarpToad is deployed on
            localRootLeafIndexes[thisLocalRootProvider] = i;
            isLocalRootProvider[thisLocalRootProvider] = true;

            // data has to be inserted before we can call update on indexes down below
            LazyIMT.insert(rootTreeData, 0);
        }

        // initialize a list of 0 elements of length _localRootProviders.length
        uint256 numberOfLocalRoots = _localRootProviders.length;
        uint256[] memory initiallocalRootBlockNumbers = new uint256[](numberOfLocalRoots);

        // and set the initial root to this list
        localRootBlockNumbers[0] = initiallocalRootBlockNumbers;
    }

    /**
     * @notice updates the current gigaRoot by querying for updates from the supplied
     * list of local root providers.  You can pull updates from a subset of local root providers for gas saving (don't have to update to all local root providers).
     */
    function updateRoot(address[] memory _localRootProviders) external {
        require(
            _localRootProviders.length >= localRootProviders.length,
            "Passed in too many localRootProviderses"
        );

        // get old array of localRootBlockNumbers at the previous gigaRoot and overwrite it with
        // new block numbers of the local root providers were updating
        uint256[] memory updatedLocalRootBlockNumbers = localRootBlockNumbers[
            gigaRoot
        ];

        // for each localRootProviders
        for (uint40 i = 0; i < _localRootProviders.length; i++) {
            address thisLocalRootProvider = _localRootProviders[i];

            // get the index of this localRootProvider (used in updatedLocalRootBlockNumbers and rootTreeData)
            uint40 localRootIndex = localRootLeafIndexes[thisLocalRootProvider];

            // make sure this bridgeAdapterAddress was initialized
            require(
                isLocalRootProvider[thisLocalRootProvider],
                "Address is not a registered root bridge address"
            );

            // create ILocalRootProvider interface
            ILocalRootProvider localRootProvider = ILocalRootProvider(
                thisLocalRootProvider
            );

            // get the most recent l2 root and the l2 block number it came from from this bridge
            (uint256 newLocalRoot, uint256 localRootBlockNumber) = localRootProvider
                .getLocalRootAndBlock();

            emit receivedNewLocalRoot(
                newLocalRoot,
                localRootBlockNumber,
                thisLocalRootProvider
            );

            // update the root in the corresponding index in the merkle tree
            // TODO: this is pretty expensive.  Optimize batch updates
            LazyIMT.update(rootTreeData, newLocalRoot, localRootIndex);

            // update the list of block numbers for the local root providers whos root we just got
            updatedLocalRootBlockNumbers[localRootIndex] = localRootBlockNumber;
        }

        // compute new giga root
        uint256 newGigaRoot = LazyIMT.root(rootTreeData);

        // set the updated list of Block numbers that this gigaRoot is updated to
        localRootBlockNumbers[newGigaRoot] = updatedLocalRootBlockNumbers;

        emit constructedNewGigaRoot(newGigaRoot);

        // set new gigaRoot in contract
        gigaRoot = newGigaRoot;
    }

    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating the root.
    // Sends the most recent gigaRoot to an array of localRootProviders
    function sendRoot(address[] memory _localRootProviders) external {
        require(
            _localRootProviders.length >= localRootProviders.length,
            "Passed in too many localRootProviderses"
        );

        for (uint256 i = 0; i < _localRootProviders.length; i++) {
            address thisLocalRootProvider = _localRootProviders[i];

            // use localRootLeafIndexes mapping to verify that this LocalRootProviderAddress was initialized
            require(
                isLocalRootProvider[thisLocalRootProvider],
                "Address is not a registered local root provider address"
            );

            ILocalRootProvider LocalRootProvider = ILocalRootProvider(
                thisLocalRootProvider
            );

            // send the most recent gigaRoot to this LocalRootProvider address. 
            // They provide local roots but also like something back. A gigaRoot :0!!!
            LocalRootProvider.receiveGigaRoot(gigaRoot);
        }
    }
}
