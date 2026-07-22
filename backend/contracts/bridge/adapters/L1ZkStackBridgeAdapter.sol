// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {ILocalRootProvider, IGigaRootRecipient, IGigaRootProvider} from "../../interfaces/IRootMessengers.sol";
import {IL1BridgeAdapter} from "../../interfaces/IL1BridgeAdapter.sol";
import {IBridgehub, L2TransactionRequestDirect, L2Message} from "../../interfaces/zkstack/IZkStack.sol";

/**
 * L1 half of the ZK Stack (Elastic Chain) adapter, replacing L1ScrollBridgeAdapter.
 *
 * One deployment serves ONE L2, but every ZK Stack chain that settles to the same L1
 * shares a single Bridgehub, so an undeployed-to chain is only a different `l2ChainId`.
 * Verified on Sepolia: zkSync Era (300) and Abstract (11124) both register in Bridgehub
 * 0x35A54c8C757806eB6820629bc82d90E056394C92 and both settle directly to L1.
 *
 * Because of that, the constructor takes ONLY the Bridgehub: every instance is byte
 * identical until initialized, and `l2ChainId` is chosen at initialize() time. That is
 * what makes spare instances useful. GigaBridge fixes its recipient set in its own
 * constructor and has no setter, so a recipient that isn't registered at genesis can
 * never be added without redeploying GigaBridge and re-wiring the entire L1 stack.
 * Deploying spare uninitialized adapters into those slots lets a future ZK Stack chain
 * be adopted with a single initialize() call instead.
 *
 * Two things differ structurally from the Scroll adapter:
 *
 *  1. L1->L2 has no `xDomainMessageSender`. The protocol aliases the L1 sender address
 *     instead, so the L2 adapter authenticates us by comparing against our aliased
 *     address. Nothing to do on this side.
 *
 *  2. L2->L1 is PULL, not push. `L1Messenger.sendToL1` on L2 emits an opaque blob with
 *     no target and no calldata, so nothing ever calls into this contract. A keeper has
 *     to fetch the Merkle proof (`zks_getL2ToL1LogProof`) and hand it to
 *     `getNewRootFromL2`, which is therefore permissionless: its security comes from
 *     the inclusion proof, not from the caller.
 */
contract L1ZkStackBridgeAdapter is IL1BridgeAdapter, ILocalRootProvider, IGigaRootRecipient {
    modifier onlyGigaBridge() {
        require(msg.sender == gigaBridge, "Not gigaBridge");
        _;
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Not the deployer");
        _;
    }

    /// @dev Fixed by the protocol for ETH-based ZK Stack chains.
    uint256 public constant L2_GAS_PER_PUBDATA_BYTE_LIMIT = 800;

    /// @dev Matches the limit the Scroll adapter used; receiveGigaRoot on the L2 side is
    ///      a single SSTORE plus one call into L2WarpToad.
    uint256 public constant DEFAULT_L2_GAS_LIMIT = 2_000_000;

    /// @dev abi.encode(uint256,uint256), the only payload sentLocalRootToL1 ever emits.
    uint256 private constant ROOT_MESSAGE_LENGTH = 64;

    address public l2ZkStackBridgeAdapter;
    // most recent warp toad state root from the L2
    uint256 public mostRecentL2Root;
    // the L2 block that the most recent L2 root came from
    uint256 public mostRecentL2RootBlockNumber;

    address public gigaBridge;

    address deployer;

    address public immutable bridgehub;

    /// @dev Deliberately NOT immutable: an instance is unassigned until initialize()
    ///      picks its chain. See the note on spare slots above.
    uint256 public l2ChainId;

    bool isInitialized = false;

    constructor(address _bridgehub) {
        deployer = msg.sender;
        bridgehub = _bridgehub;
    }

    function initialize(
        uint256 _l2ChainId,
        address _l2ZkStackBridgeAdapter,
        address _gigaRootBridge
    ) external onlyDeployer() {
        require(isInitialized == false, "cant initialize only once");
        require(_l2ChainId != 0, "l2ChainId not set");
        isInitialized = true;
        l2ChainId = _l2ChainId;
        l2ZkStackBridgeAdapter = _l2ZkStackBridgeAdapter;
        gigaBridge = _gigaRootBridge;
    }

    /**
     * @notice Submit a proof that the L2 adapter published a local root, and adopt it.
     * @dev Permissionless on purpose - the L2->L1 direction has no auto-relay, so
     *      whoever runs the keeper submits this. Safety comes from proveL2MessageInclusion.
     *
     *      `sender` is pinned to l2ZkStackBridgeAdapter rather than taken as an argument,
     *      so a proof for anyone else's message simply fails to verify. That single line
     *      is what replaces Scroll's xDomainMessageSender check.
     *
     * @param _batchNumber      L1 batch containing the L2 tx (receipt's l1BatchNumber)
     * @param _index            proof id, from zks_getL2ToL1LogProof
     * @param _txNumberInBatch  receipt's l1BatchTxIndex
     * @param _message          abi.encode(localRoot, l2BlockNumber) as passed to sendToL1
     * @param _proof            Merkle proof from zks_getL2ToL1LogProof
     */
    function getNewRootFromL2(
        uint256 _batchNumber,
        uint256 _index,
        uint16 _txNumberInBatch,
        bytes calldata _message,
        bytes32[] calldata _proof
    ) external {
        require(isInitialized, "not initialized");
        require(_message.length == ROOT_MESSAGE_LENGTH, "malformed root message");

        bool included = IBridgehub(bridgehub).proveL2MessageInclusion(
            l2ChainId,
            _batchNumber,
            _index,
            L2Message({
                txNumberInBatch: _txNumberInBatch,
                sender: l2ZkStackBridgeAdapter,
                data: _message
            }),
            _proof
        );
        require(included, "L2 message inclusion proof failed");

        (uint256 _l2Root, uint256 _l2BlockNumber) = abi.decode(_message, (uint256, uint256));

        if (mostRecentL2RootBlockNumber <= _l2BlockNumber) {
            emit ReceivedNewL2Root(_l2Root, _l2BlockNumber);
            mostRecentL2Root = _l2Root;
            mostRecentL2RootBlockNumber = _l2BlockNumber;
        }
    }

    function receiveGigaRoot(
        uint256 _newGigaRoot
    ) external payable onlyGigaBridge {
        _bridgeGigaRootToL2(_newGigaRoot, DEFAULT_L2_GAS_LIMIT);
    }

    /**
     * @notice Escape hatch for when DEFAULT_L2_GAS_LIMIT is not enough, and a way for
     *         anyone to re-push a root whose L1->L2 message failed on L2.
     * @dev Deliberately does NOT take a root argument. It reads the canonical one from
     *      the GigaBridge, so being permissionless costs nothing: the worst a caller can
     *      do is pay to deliver the root that GigaBridge already holds.
     *
     *      The Scroll adapter this replaces had a `receiveGigaRoot(uint256,uint256)`
     *      overload with no access control at all, which let anyone push an arbitrary
     *      giga root through to L2WarpToad. Do not reintroduce that shape.
     */
    function pushGigaRoot(uint256 _l2GasLimit) external payable {
        require(isInitialized, "not initialized");
        _bridgeGigaRootToL2(IGigaRootProvider(gigaBridge).gigaRoot(), _l2GasLimit);
    }

    function _bridgeGigaRootToL2(uint256 _newGigaRoot, uint256 _l2GasLimit) internal {
        // Must be read with tx.gasprice inside the spending transaction. The Bridgehub
        // re-derives the requirement from tx.gasprice at execution time, so a baseCost
        // computed off-chain races the base fee and reverts - and eth_call does not
        // reproduce tx.gasprice, so simulation does not catch it.
        uint256 baseCost = IBridgehub(bridgehub).l2TransactionBaseCost(
            l2ChainId,
            tx.gasprice,
            _l2GasLimit,
            L2_GAS_PER_PUBDATA_BYTE_LIMIT
        );
        require(msg.value >= baseCost, "msg.value below L2 base cost");

        IBridgehub(bridgehub).requestL2TransactionDirect{value: baseCost}(
            L2TransactionRequestDirect({
                chainId: l2ChainId,
                mintValue: baseCost,
                l2Contract: l2ZkStackBridgeAdapter,
                l2Value: 0,
                l2Calldata: abi.encodeWithSignature(
                    "receiveGigaRoot(uint256)",
                    _newGigaRoot
                ),
                l2GasLimit: _l2GasLimit,
                l2GasPerPubdataByteLimit: L2_GAS_PER_PUBDATA_BYTE_LIMIT,
                factoryDeps: new bytes[](0),
                // EOAs are not aliased, so an unspent L2 refund lands on the same
                // address there. Mirrors the Scroll adapter's refund target.
                refundRecipient: tx.origin
            })
        );

        // baseCost is exact (same tx.gasprice), so anything above it was overpayment by
        // the caller. Return it on L1 rather than stranding it as an L2 refund.
        uint256 excess = msg.value - baseCost;
        if (excess > 0) {
            (bool ok, ) = payable(tx.origin).call{value: excess}("");
            require(ok, "L1 refund failed");
        }
    }

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
