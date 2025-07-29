// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {IL2ScrollMessenger} from "@scroll-tech/contracts/L2/IL2ScrollMessenger.sol";
import {IGigaRootProvider, IGigaRootRecipient, ILocalRootRecipient, ILocalRootProvider} from "../interfaces/IRootMessengers.sol";
import {IL2BridgeAdapter} from "../interfaces/IL2BridgeAdapter.sol";

contract L2ScrollBridgeAdapter is
    IL2BridgeAdapter,
    IGigaRootProvider,
    ILocalRootRecipient
{
    uint256 public gigaRoot;

    // TODO erhm so scroll probably dropped L1SLOAD 
    // address L1_SLOAD_ADDRESS = 0x0000000000000000000000000000000000000101;
    // uint256 gigaRootL1Slot = 0;

    address l1ScrollBridgeAdapter;
    address l2ScrollMessenger;
    address l2WarpToad; // L2 warptoad

    //
    constructor(
        address _l2ScrollMessenger,
        address _l1ScrollBridgeAdapter,
        address _l2WarpToad
    ) {
        l1ScrollBridgeAdapter = _l1ScrollBridgeAdapter;
        l2ScrollMessenger = _l2ScrollMessenger;
        l2WarpToad = _l2WarpToad;
    }

    // extra for the contracts that want it.
    // receiveGigaRoot (called by the L2ScrollBridge) will send it to L2Warptoad already
    function sendGigaRoot(address _gigaRootRecipient) public {
        IGigaRootRecipient(_gigaRootRecipient).receiveGigaRoot(gigaRoot);
    }

    function sentLocalRootToL1(uint256 _gasLimit) public {
        (uint256 _l2Root, uint256 _l2BlockNumber) = ILocalRootProvider(
            l2WarpToad
        ).getLocalRootAndBlock();
        // sendMessage is able to execute any function by encoding the abi using the encodeWithSignature function
        //IScrollMessenger(l2ScrollMessenger).sendMessage{value: msg.value}(
        IL2ScrollMessenger(l2ScrollMessenger).sendMessage{value: 0}( // can this be 0?? or can we pay for some relayer?? check docs!
            l1ScrollBridgeAdapter, // TODO send to a L1Adapter first
            0,
            abi.encodeWithSignature("getNewRootFromL2(uint256,uint256)",_l2Root,_l2BlockNumber),
            _gasLimit,
            msg.sender
        );
    }
   
    function receiveGigaRoot(uint256 _gigaRoot) public {
        require(msg.sender == l2ScrollMessenger,"function not called by l1ScrollMessenger");
        require(l1ScrollBridgeAdapter == IL2ScrollMessenger(l2ScrollMessenger).xDomainMessageSender(),"contract messaging from L1 is not the L1ScrollBridgeAdapter");
        gigaRoot = _gigaRoot;
        sendGigaRoot(l2WarpToad);
    }
}