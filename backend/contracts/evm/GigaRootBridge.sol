// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;
import {ILocalRootProvider} from "./interfaces/ILocalRootProvider.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LazyIMT, LazyIMTData} from "@zk-kit/lazy-imt.sol/LazyIMT.sol";

contract GigaRootBridge {
    // get gigaRootFrom destination chain. look up at which block that got created at with: ConstructedNewGigaRoot(gigaRoot)
    // get all leaves of giga tree by scanning for all indexes with ReceivedNewLocalRoot. Start at the block number found above ^
    // get allIndexes you need by looking at amountOfLocalRoots
    // work ur way down until you found all indexes.

    event ConstructedNewGigaRoot(uint256 indexed newGigaRoot); 

    event ReceivedNewLocalRoot(
        uint40 indexed localRootIndex,
        uint256 indexed newLocalRoot, 
        uint256  localRootBlockNumber
    );

    LazyIMTData public rootTreeData; // does this need to be public? yes? maybe we can sync clients faster somehow?
    uint8 public maxTreeDepth;
    uint256 public gigaRoot;

    mapping(address => uint40) private localRootProvidersIndexes; // getters are public btw
    mapping(address => uint256) public localRootBlockNumbers; // current blocknumber per root. History is in events. We need this to check that incoming roots are not older than current
    uint256 public amountOfLocalRoots;

    /**
     * @notice Initialize the root bridge
     * @param _localRootProviders - the L1 contracts that can receive roots from corresponding locals
     */
    constructor(address[] memory _localRootProviders, uint8 _maxTreeDepth) {
        maxTreeDepth = _maxTreeDepth;
        // init doesn't add any leaves. But the leaves are all 0 by default!
        LazyIMT.init(rootTreeData, _maxTreeDepth);

        // for each L1LocalRootProvider...
        for (uint40 i = 0; i < _localRootProviders.length; i++) {
            _setLocalRootProvidersIndex(_localRootProviders[i], i);
        }
        amountOfLocalRoots = _localRootProviders.length; 
    }

    function _setLocalRootProvidersIndex(address _localRootProvider, uint40 index) private {
        localRootProvidersIndexes[_localRootProvider] = index + 1; //+1 because a mapping defaults to 0. so those don't exist!
    }

    function getLocalRootProvidersIndex(address _localRootProvider) public view returns(uint40) {
        return localRootProvidersIndexes[_localRootProvider] - 1; //-1 because a mapping defaults to 0. so those don't exist!
    }

    function isLocalRootProviders(address _localRootProvider) public view returns(bool) {
        return localRootProvidersIndexes[_localRootProvider] > 0;
    }

    /**
     * @notice updates the current gigaRoot by querying for updates from the supplied
     * list of local root providers.  You can pull updates from a subset of local root providers for gas saving (don't have to update to all local root providers).
     */
    function updateRoot(address[] memory _localRootProviders) external {
        // require(
        //     _localRootProviders.length <= localRootProviders.length,
        //     "Passed in too many localRootProviders"
        // ); //jimjim: i don't think we need this

        // for each localRootProviders
        for (uint40 i = 0; i < _localRootProviders.length; i++) {
            address localRootProviderAddress = _localRootProviders[i];

            // get the index of this localRootProvider (used in updatedLocalRootBlockNumbers and rootTreeData)
            uint40 localRootIndex = getLocalRootProvidersIndex(localRootProviderAddress);

            // make sure this bridgeAdapterAddress was initialized
            require(
                isLocalRootProviders(localRootProviderAddress),
                "Address is not a registered root bridge address"
            );

            // create ILocalRootProvider interface
            ILocalRootProvider localRootProvider = ILocalRootProvider(
                localRootProviderAddress
            );

            // get the most recent l2 root and the l2 block number it came from from this bridge
            (uint256 newLocalRoot, uint256 localRootBlockNumber) = localRootProvider.getLocalRootAndBlock();
            require(localRootBlockNumber >= localRootBlockNumbers[localRootProviderAddress], "localRoot has to be newer or the same"); 
            localRootBlockNumbers[localRootProviderAddress] = localRootBlockNumber;

            LazyIMT.update(rootTreeData, newLocalRoot, localRootIndex);
            //TODO can we emit 33 events?
            emit ReceivedNewLocalRoot(
                localRootIndex,
                newLocalRoot,
                localRootBlockNumber
            );
        }
        // compute new giga root
        uint256 newGigaRoot = LazyIMT.root(rootTreeData);
        emit ConstructedNewGigaRoot(newGigaRoot);

        // set new gigaRoot in contract
        gigaRoot = newGigaRoot;
    }

    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating their localRoot.
    // since most of the time everyone wants the latest gigaRoot but not everyone has a localRoot that is new
    // Sends the most recent gigaRoot to an array of localRootProviders
    function sendRoot(address[] memory _localRootProviders) external {
        // require(
        //     _localRootProviders.length <= localRootProviders.length,
        //     "Passed in too many localRootProviders"
        // ); //jimjim: i don't think we need this

        for (uint256 i = 0; i < _localRootProviders.length; i++) {
            address thisLocalRootProvider = _localRootProviders[i];

            // use localRootLeafIndexes mapping to verify that this LocalRootProviderAddress was initialized
            // require(
            //     isLocalRootProvider[thisLocalRootProvider],
            //     "Address is not a registered local root provider address"
            // );
            // we dont need that check. Any can get a giga root if they want!

            ILocalRootProvider LocalRootProvider = ILocalRootProvider(
                thisLocalRootProvider
            );

            // send the most recent gigaRoot to this LocalRootProvider address. 
            // They provide local roots but also like something back. A gigaRoot :0!!!
            LocalRootProvider.receiveGigaRoot(gigaRoot);
        }
    }
}
