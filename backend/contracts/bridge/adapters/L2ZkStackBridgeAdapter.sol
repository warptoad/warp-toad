// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {IGigaRootProvider, IGigaRootRecipient, ILocalRootRecipient, ILocalRootProvider} from "../../interfaces/IRootMessengers.sol";
import {IL2BridgeAdapter} from "../../interfaces/IL2BridgeAdapter.sol";
import {IL1Messenger, AddressAliasHelper} from "../../interfaces/zkstack/IZkStack.sol";

/**
 * L2 half of the ZK Stack adapter, replacing L2ScrollBridgeAdapter.
 *
 * Deploys unchanged on any ZK Stack chain: the L1Messenger system contract lives at the
 * same address everywhere, and the only chain-specific value (the L1 adapter address) is
 * a constructor argument.
 */
contract L2ZkStackBridgeAdapter is
    IL2BridgeAdapter,
    IGigaRootProvider,
    ILocalRootRecipient
{
    /// @dev L1Messenger system contract, same address on every ZK Stack chain.
    IL1Messenger public constant L1_MESSENGER =
        IL1Messenger(0x0000000000000000000000000000000000008008);

    uint256 public gigaRoot;

    address public l1ZkStackBridgeAdapter;
    /// @dev Cached L1->L2 alias of l1ZkStackBridgeAdapter. This is the ZK Stack
    ///      equivalent of checking Scroll's xDomainMessageSender(): the protocol rewrites
    ///      an L1 contract sender to this address, so comparing msg.sender against it
    ///      proves the call originated from our L1 adapter.
    address public l1ZkStackBridgeAdapterAliased;
    address public l2WarpToad;

    event SentLocalRootToL1(uint256 indexed localRoot, uint256 l2BlockNumber);
    event NewGigaRoot(uint256 indexed gigaRoot);

    constructor(address _l1ZkStackBridgeAdapter, address _l2WarpToad) {
        l1ZkStackBridgeAdapter = _l1ZkStackBridgeAdapter;
        l1ZkStackBridgeAdapterAliased = AddressAliasHelper.applyL1ToL2Alias(
            _l1ZkStackBridgeAdapter
        );
        l2WarpToad = _l2WarpToad;
    }

    // extra for the contracts that want it.
    // receiveGigaRoot (called from L1) will send it to L2WarpToad already
    function sendGigaRoot(address _gigaRootRecipient) public payable {
        IGigaRootRecipient(_gigaRootRecipient).receiveGigaRoot(gigaRoot);
    }

    /**
     * @notice Publish the local root to L1 as an L2->L1 message.
     * @dev Unlike Scroll there is no target, no calldata and no gas limit here: sendToL1
     *      just records an opaque blob keyed by msg.sender. Nothing is called on L1. A
     *      keeper watches SentLocalRootToL1, pulls zks_getL2ToL1LogProof for this tx, and
     *      submits it to L1ZkStackBridgeAdapter.getNewRootFromL2 once the batch executes.
     *
     *      Payload must stay abi.encode(uint256,uint256) - the L1 side length-checks it.
     */
    function sentLocalRootToL1() public {
        (uint256 _l2Root, uint256 _l2BlockNumber) = ILocalRootProvider(
            l2WarpToad
        ).getLocalRootAndBlock();

        L1_MESSENGER.sendToL1(abi.encode(_l2Root, _l2BlockNumber));

        emit SentLocalRootToL1(_l2Root, _l2BlockNumber);
    }

    function receiveGigaRoot(uint256 _gigaRoot) public payable {
        require(
            msg.sender == l1ZkStackBridgeAdapterAliased,
            "caller is not the aliased L1ZkStackBridgeAdapter"
        );
        gigaRoot = _gigaRoot;
        sendGigaRoot(l2WarpToad);
        emit NewGigaRoot(_gigaRoot);
    }
}
