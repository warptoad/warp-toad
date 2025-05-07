// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {IScrollMessenger} from "@scroll-tech/contracts/libraries/IScrollMessenger.sol";
import {IGigaRootProvider, IGigaRootRecipient, ILocalRootRecipient, ILocalRootProvider} from "../interfaces/IRootMessengers.sol";
import {IL2BridgeAdapter} from "../interfaces/IL2BridgeAdapter.sol";

contract L2ScrollAdapter is
    IL2BridgeAdapter,
    IGigaRootProvider,
    ILocalRootRecipient
{
    uint256 public gigaRoot;

    // TODO erhm so scroll probably dropped L1SLOAD 
    // address L1_SLOAD_ADDRESS = 0x0000000000000000000000000000000000000101;
    // uint256 gigaRootL1Slot = 0;

    address gigaBridge;
    address l2ScrollMessenger;
    address l2WarpToad; // L2 warptoad

    //
    constructor(
        address _l2ScrollMessenger,
        address _gigaBridge,
        address _l2WarpToad
    ) {
        gigaBridge = _gigaBridge;
        l2ScrollMessenger = _l2ScrollMessenger;
        l2WarpToad = _l2WarpToad;
    }

    function sendGigaRoot(address _gigaRootRecipient) public {
        IGigaRootRecipient(_gigaRootRecipient).receiveGigaRoot(gigaRoot);
    }

    function sentLocalRootToL1(uint256 _gasLimit) public {
        (uint256 _l2Root, uint256 _l2BlockNumber) = ILocalRootProvider(
            l2WarpToad
        ).getLocalRootAndBlock();
        // sendMessage is able to execute any function by encoding the abi using the encodeWithSignature function
        //IScrollMessenger(l2ScrollMessenger).sendMessage{value: msg.value}(
        IScrollMessenger(l2ScrollMessenger).sendMessage{value: 0}( // can this be 0?? or can we pay for some relayer?? check docs!
            gigaBridge,
            0,
            abi.encodeWithSignature(
                "getNewRootFromL2(uint256 _l2Root, uint256 _l2BlockNumber)",
                _l2Root,_l2BlockNumber 
            ),
            _gasLimit,
            msg.sender
        );
    }
   
    function receiveGigaRoot(uint256 _gigaRoot) public {
        gigaRoot = _gigaRoot;
        sendGigaRoot(l2WarpToad);
    }

    // TODO erhm so scroll probably dropped L1SLOAD 
    // function readSingleSlot(
    //     address l1_contract,
    //     uint256 slot
    // ) public view returns (bytes memory) {
    //     bytes memory input = abi.encodePacked(l1_contract, slot);

    //     bool success;
    //     bytes memory result;

    //     (success, result) = L1_SLOAD_ADDRESS.staticcall(input);
    //     //result = IL1SLOADmock(L1_SLOAD_ADDRESS).fallback(input);
    //     if (!success) {
    //         revert("L1SLOAD failed");
    //     }
    //     return result;
    // }
}