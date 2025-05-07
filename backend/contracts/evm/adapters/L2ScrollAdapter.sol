
// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {IScrollMessenger} from "@scroll-tech/contracts/libraries/IScrollMessenger.sol";
import {IGigaRootProvider, IGigaRootRecipient, ILocalRootRecipient} from  "../interfaces/IRootMessengers.sol";
import {IL2BridgeAdapter} from "../interfaces/IL2BridgeAdapter.sol";

contract L2ScrollAdapter is IL2BridgeAdapter, IGigaRootProvider, ILocalRootRecipient  {
    uint256 public gigaRoot;

    address L1SOAD = 0x0000000000000000000000000000000000000101;
    uint256 gigaRootL1Slot = 0;

    function sendGigaRoot(address[] memory _gigaRootRecipients) external {
        for (uint256 i = 0; i < _gigaRootRecipients.length; i++) {
            address gigaRootRecipient = _gigaRootRecipients[i];
            // in this case it's just the L2 instance of warptoad
            // TODO gas golf this for loop out of here. But that fucks with our naming scheme again :/ (gas > naming scheme tho)
            IGigaRootRecipient(gigaRootRecipient).receiveGigaRoot(gigaRoot);
        }
    }
}
// gigaRoot slot
// L1SLOAD addr

// constructor
// l2ScrollMessenger
// gigaBridge address
// dont need L2Warptoad here. L2Warptoad will check if message from adapter. adapter can have L2Warptoad address as argument (or any contract that want gigaRoot)




// read gigaRoot from L1 with L1SlOAD then send it to gigaRootRecipient
// fn update_gigaroot(address: gigaRootRecipient) {

// }



// pull local root from warptoad with getLocalRootAndBlock. Send that through the bridge
// fn send_root_to_l1(uint32 gasLimit) {
    // _l2Root, _l2BlockNumber = warptoad.getLocalRootAndBlock()
    // IScrollMessenger scrollMessenger = IScrollMessenger(l2ScrollMessenger);
    // // sendMessage is able to execute any function by encoding the abi using the encodeWithSignature function
    // scrollMessenger.sendMessage{value:msg.value}(
    //     gigaBridge,
    //     0,
    //     abi.encodeWithSignature("getNewRootFromL2(uint256 _l2Root, uint256 _l2BlockNumber)", warptoad.getLocalRootAndBlock()),
    //     gasLimit,
    //     msg.sender
    // );

// }

