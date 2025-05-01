// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;
import "./IL1RootBridgeAdapter.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LazyIMT, LazyIMTData} from "@zk-kit/lazy-imt.sol/LazyIMT.sol";

contract GigaRootBridge {
    event constructedNewGigaRoot(uint256 indexed newGigaRoot);

    event receivedNewL2Root(
        uint256 indexed newL2Root,
        // l2 block number that this l2 root came from
        uint32 indexed l2BlockNumber,
        address indexed rootBridgeAdapter
    );

    LazyIMTData public rootTreeData; // does this need to be public?
    IL1RootBridgeAdapter[] public rootBridgeAdapters;
    // just a membership mapping
    mapping(address => bool) isRootBridgeAdapter;
    // mapping of the rootBridgeAdapter addr to their L2 root's position in all
    // the arrays used (rootTreeData, gigaRootL2BlockNumbers, and rootBridgeAdapters)
    mapping(address => uint40) public l2LeafIndexes;
    // mapping gigaRoot => block number of the L2 block each L2 root (leaf) came from
    // The length of the array is always rootBridgeAdapters.length
    mapping(uint256 => uint32[]) public gigaRootL2BlockNumbers;
    uint8 public maxTreeDepth;
    uint256 public gigaRoot;

    /**
     * @notice Initialize the root bridge
     * @param _bridgeAdapterAddresses - the L1 contracts that can receive roots from corresponding L2s
     */
    constructor(address[] memory _bridgeAdapterAddresses, uint8 _maxTreeDepth) {
        maxTreeDepth = _maxTreeDepth;
        // init doesn't add any leaves
        LazyIMT.init(rootTreeData, _maxTreeDepth);

        // for each L1RootBridgeAdapter...
        for (uint40 i = 0; i < _bridgeAdapterAddresses.length; i++) {
            address thisBridgeAdapterAddress = _bridgeAdapterAddresses[i];

            // add to list of rootBridges
            rootBridgeAdapters.push(
                IL1RootBridgeAdapter(thisBridgeAdapterAddress)
            );

            // note the index of this root bridge.  This index will be used to in
            // rootTreeData, gigaRootL2BlockNumbers, and rootBridgeAdapters to keep a
            // "state" for each L2 which WarpToad is deployed on
            l2LeafIndexes[thisBridgeAdapterAddress] = i;
            isRootBridgeAdapter[thisBridgeAdapterAddress] = true;

            // data has to be inserted before we can call update on indexes down below
            LazyIMT.insert(rootTreeData, 0);
        }

        // initialize a list of 0 elements of length _bridgeAdapterAddresses.length
        uint256 numberOfL2s = _bridgeAdapterAddresses.length;
        uint32[] memory initialL2BlockNumbers = new uint32[](numberOfL2s);

        // and set the initial root to this list
        gigaRootL2BlockNumbers[0] = initialL2BlockNumbers;
    }

    /**
     * @notice updates the current gigaRoot by querying for updates from the supplied
     * list of L2 bridges.  You can pull updates from a subset of L2s for gas saving (don't have to update to all l2s).
     */
    function updateRoot(address[] memory _bridgeAdapterAddresses) external {
        require(
            _bridgeAdapterAddresses.length >= rootBridgeAdapters.length,
            "Passed in too many bridgeAdapterAddresseses"
        );

        // get old array of l2BlockNumbers at the previous gigaRoot and overwrite it with
        // new block numbers of the L2s were updating
        uint32[] memory updatedL2BlockNumbers = gigaRootL2BlockNumbers[
            gigaRoot
        ];

        // for each l2BridgeAdapter
        for (uint40 i = 0; i < _bridgeAdapterAddresses.length; i++) {
            address thisBridgeAdapterAddress = _bridgeAdapterAddresses[i];

            // get the index of this l2 (used in updatedL2BlockNumbers and rootTreeData)
            uint40 l2LeafIndex = l2LeafIndexes[thisBridgeAdapterAddress];

            // make sure this bridgeAdapterAddress was initialized
            require(
                isRootBridgeAdapter[thisBridgeAdapterAddress],
                "Address is not a registered root bridge address"
            );

            // create IL1RootBridgeAdapter interface
            IL1RootBridgeAdapter rootBridgeAdapter = IL1RootBridgeAdapter(
                thisBridgeAdapterAddress
            );

            // get the most recent l2 root and the l2 block number it came from from this bridge
            (uint256 newL2Root, uint32 l2BlockNumber) = rootBridgeAdapter
                .getMostRecentRootAndL2Block();

            emit receivedNewL2Root(
                newL2Root,
                l2BlockNumber,
                thisBridgeAdapterAddress
            );

            // update the root in the corresponding index in the merkle tree
            // TODO: this is pretty expensive.  Optimize batch updates
            LazyIMT.update(rootTreeData, newL2Root, l2LeafIndex);

            // update the list of L2 block numbers for the L2 whos root we just got
            updatedL2BlockNumbers[l2LeafIndex] = l2BlockNumber;
        }

        // compute new giga root
        uint256 newGigaRoot = LazyIMT.root(rootTreeData);

        // set the updated list of L2Block numbers that this gigaRoot is updated to
        gigaRootL2BlockNumbers[newGigaRoot] = updatedL2BlockNumbers;

        emit constructedNewGigaRoot(newGigaRoot);

        // set new gigaRoot in contract
        gigaRoot = newGigaRoot;
    }

    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating the root.
    // Sends the most recent gigaRoot to an array of rootBridgeAdapters
    function sendRoot(address[] memory _bridgeAdapterAddresses) external {
        require(
            _bridgeAdapterAddresses.length >= rootBridgeAdapters.length,
            "Passed in too many bridgeAdapterAddresseses"
        );

        for (uint256 i = 0; i < _bridgeAdapterAddresses.length; i++) {
            address thisBridgeAdapterAddress = _bridgeAdapterAddresses[i];

            // use l2LeafIndexes mapping to verify that this rootBridgeAdapterAddress was initialized
            require(
                isRootBridgeAdapter[thisBridgeAdapterAddress],
                "Address is not a registered root bridge adapter address"
            );

            IL1RootBridgeAdapter rootBridgeAdapter = IL1RootBridgeAdapter(
                thisBridgeAdapterAddress
            );

            // send the most recent gigaRoot to this L1RootBridgeAdapter address, to later be bridged over
            // and consumed by the corresponding L2RootBridgeAdapter on the L2
            rootBridgeAdapter.sendGigaRootToAdapter(gigaRoot);
        }
    }
}
