// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {ILocalRootProvider} from "./interfaces/ILocalRootProvider.sol";
import {IGigaRootRecipient} from "./interfaces/IGigaRootRecipient.sol";
import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LazyIMT, LazyIMTData} from "@zk-kit/lazy-imt.sol/LazyIMT.sol";

contract GigaBridge {
    // get gigaRootFrom destination chain. look up at which block that got created at with: ConstructedNewGigaRoot(gigaRoot)
    // get all leaves of giga tree by scanning for all indexes with ReceivedNewLocalRoot. Start at the block number found above ^
    // get allIndexes you need by looking at amountOfLocalRoots
    // work ur way down until you found all indexes.

    event ConstructedNewGigaRoot(uint256 indexed newGigaRoot); 

    event ReceivedNewLocalRoot(
        uint256 indexed newLocalRoot,
        uint40 indexed localRootIndex, 
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
     * @param _gigaRootRecipients - the L1 contracts that can receive roots from corresponding locals
     */
    constructor(address[] memory _gigaRootRecipients, uint8 _maxTreeDepth) {
        maxTreeDepth = _maxTreeDepth;
        // init doesn't add any leaves. But the leaves are all 0 by default!
        LazyIMT.init(rootTreeData, _maxTreeDepth);

        // for each L1LocalRootProvider...
        for (uint40 i = 0; i < _gigaRootRecipients.length; i++) {
            _setLocalRootProvidersIndex(_gigaRootRecipients[i], i);
            LazyIMT.insert(rootTreeData,0); // TODO this is kind of expensive way to get around the error from `lazyIMT.update`: `leaf must exist`
        }
        amountOfLocalRoots = _gigaRootRecipients.length; 

        // other wise gigaRoot can be 0. Which i cant see how that would be a issue but it scares so we do this to be safe
        gigaRoot = LazyIMT.root(rootTreeData, maxTreeDepth);
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
    function updateRoot(address[] memory _localRootProvider) external {
        // for each localRootProviders
        for (uint40 i = 0; i < _localRootProvider.length; i++) {
            address localRootProvider = _localRootProvider[i];

            // get the index of this localRootProvider (used in updatedLocalRootBlockNumbers and rootTreeData)
            uint40 localRootIndex = getLocalRootProvidersIndex(localRootProvider);

            // make sure this bridgeAdapterAddress was initialized
            require(
                isLocalRootProviders(localRootProvider),
                "Address is not a registered root bridge address"
            );

            // get the most recent l2 root and the l2 block number it came from from this bridge
            (uint256 newLocalRoot, uint256 localRootBlockNumber) = ILocalRootProvider(localRootProvider).getLocalRootAndBlock();

            require(localRootBlockNumber >= localRootBlockNumbers[localRootProvider], "localRoot has to be newer or the same"); 
            localRootBlockNumbers[localRootProvider] = localRootBlockNumber;

            LazyIMT.update(rootTreeData, newLocalRoot, localRootIndex);
            //TODO can we emit 33 events?
            emit ReceivedNewLocalRoot(
                newLocalRoot,
                localRootIndex,
                localRootBlockNumber
            );
        }
        // compute new giga root
        uint256 newGigaRoot = LazyIMT.root(rootTreeData, maxTreeDepth);
        emit ConstructedNewGigaRoot(newGigaRoot);

        // set new gigaRoot in contract
        gigaRoot = newGigaRoot;
    }

    // Made this a second function because the addresses that want the gigaRoot
    // might be different from the addresses that are updating their localRoot.
    // since most of the time everyone wants the latest gigaRoot but not everyone has a localRoot that is new
    // Sends the most recent gigaRoot to an array of localRootProviders
    function sendRoot(address[] memory _gigaRootRecipients) external {
        for (uint256 i = 0; i < _gigaRootRecipients.length; i++) {
            address gigaRootRecipient = _gigaRootRecipients[i];

            // send the most recent gigaRoot to this LocalRootProvider address. 
            // They provide local roots but also like something back. A gigaRoot :0!!!
            IGigaRootRecipient(gigaRootRecipient).receiveGigaRoot(gigaRoot);
        }
    }
}
