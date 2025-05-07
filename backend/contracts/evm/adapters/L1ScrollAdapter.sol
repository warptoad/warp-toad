// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {ILocalRootProvider, IGigaRootRecipient} from  "../interfaces/IRootMessengers.sol";
import {IL1BridgeAdapter} from "../interfaces/IL1BridgeAdapter.sol";
import {IScrollMessenger} from "@scroll-tech/contracts/libraries/IScrollMessenger.sol";

// no IGigaRootRecipient because we have L1SLOAD!
contract L1ScrollBridgeAdapter is IL1BridgeAdapter, ILocalRootProvider {
    modifier onlyGigaBridge() {
        require(msg.sender == gigaBridge, "Not gigaBridge");
        _; // what is that?
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Not the deployer");
        _; // what is that?
    }
    address public l2ScrollBridgeAdapter;
    // most recent warp toad state root from the L2
    uint256 public mostRecentL2Root;
    // the L2 block that the most recent L2 root came from
    uint256 public mostRecentL2RootBlockNumber;

    address public gigaBridge;

    address deployer;

    address public l1ScrollMessenger;

    bool isInitialized = false;
    constructor(address _l1ScrollMessenger ) {
        deployer = msg.sender;
        l1ScrollMessenger = _l1ScrollMessenger;
    }

    function initialize(
        address _l2ScrollBridgeAdapter,
        address _gigaRootBridge
    ) external onlyDeployer() {
        require(isInitialized == false, "cant initialize twice");
        isInitialized = true;
        l2ScrollBridgeAdapter = _l2ScrollBridgeAdapter;
        gigaBridge = _gigaRootBridge;
    }


    function getNewRootFromL2(uint256 _l2Root, uint256 _l2BlockNumber) external {
        require(msg.sender == l1ScrollMessenger,"function not called by l1ScrollMessenger");
        require(l2ScrollBridgeAdapter == IScrollMessenger(l1ScrollMessenger).xDomainMessageSender(),"contract messaging from L2 is not the L2ScrollBridgeAdapter");

        emit ReceivedNewL2Root(_l2Root, _l2BlockNumber);

        mostRecentL2Root = _l2Root;
        mostRecentL2RootBlockNumber = _l2BlockNumber;
    }

    // not needed. we use L1SLOAD! 
    // function receiveGigaRoot(
    //     uint256 _newGigaRoot
    // ) external onlyGigaBridge {
    //     _bridgeGigaRootToL2(_newGigaRoot);
    // }

    // function _bridgeGigaRootToL2(uint256 _newGigaRoot) internal {
    // } 

    function getLocalRootAndBlock() view external returns (uint256, uint256) {
        require(
            mostRecentL2Root > 0,
            "An L2 root hasn't yet been bridged to this contract. refreshRoot must be called."
        );
        require(
            mostRecentL2RootBlockNumber > 0,
            "An L2 root hasn't yet been bridged to this contract. refreshRoot must be called."
        );
        return (mostRecentL2Root, mostRecentL2RootBlockNumber);
    }
}
