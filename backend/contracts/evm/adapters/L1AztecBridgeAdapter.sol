// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

// Messaging
import {IRegistry} from "../aztec-interfaces/IRegistry.sol";
import {IInbox} from "../aztec-interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "../aztec-interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "../aztec-interfaces/IRollup.sol";
import {DataStructures} from "../aztec-interfaces/CoreDataStructures.sol";
import {ILocalRootProvider, IGigaRootRecipient} from  "../interfaces/IRootMessengers.sol";
// hash for message passing to L2
import {Hash} from "../aztec-interfaces/crypto/Hash.sol";
import {IL1BridgeAdapter} from "../interfaces/IL1BridgeAdapter.sol";

contract L1AztecBridgeAdapter is IL1BridgeAdapter, ILocalRootProvider, IGigaRootRecipient {
    event NewGigaRootSentToAztec(bytes32 indexed newGigaRoot, bytes32 key, uint256 index); //newGigaRoot is also the content hash! wow!'
    
    modifier onlyGigaBridge() {
        require(msg.sender == gigaBridge, "Not gigaBridge");
        _; // what is that?
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "Not the deployer");
        _; // what is that?
    }
    // IRegistry public registry; not used
    bytes32 public l2AztecBridgeAdapter;
    // most recent warp toad state root from the L2
    uint256 public mostRecentL2Root;
    // the L2 block that the most recent L2 root came from
    uint256 public mostRecentL2RootBlockNumber;

    IRollup public rollup;
    IOutbox public outbox;
    IInbox public inbox;
    uint256 public rollupVersion;

    address public gigaBridge;

    address deployer;

    bool isInitialized = false;
    constructor() {
        deployer = msg.sender;
    }
    /**
     * @notice Initialize the portal
     * @param _registry - The registry address
     * @param _l2AztecBridgeAdapter - The L2 bridge address
     */
    function initialize(
        address _registry,
        bytes32 _l2AztecBridgeAdapter,
        address _gigaRootBridge
    ) external onlyDeployer() {
        require(isInitialized == false, "cant initialize twice");
        isInitialized = true;

        l2AztecBridgeAdapter = _l2AztecBridgeAdapter;

        rollup = IRollup(IRegistry(_registry).getCanonicalRollup());
        outbox = rollup.getOutbox();
        inbox = rollup.getInbox();
        rollupVersion = rollup.getVersion();

        gigaBridge = _gigaRootBridge;
    }

    /**
     * @notice adds an L2 message which can only be consumed publicly on Aztec
     * @param _newGigaRoot - The new gigaRoot to send to L2 as a message
     */
    function receiveGigaRoot(
        uint256 _newGigaRoot
    ) external onlyGigaBridge {
        _bridgeGigaRootToL2(_newGigaRoot);
    }

    function _bridgeGigaRootToL2(uint256 _newGigaRoot) internal {
        // l2AztecBridgeAdapter is the Aztec address of the contract that will be retrieving the
        // message on the L2
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(
            l2AztecBridgeAdapter,
            rollupVersion
        );

        // Aztec docs assume that the message being passed is larger than a Field element
        // so it recommends you hash it and verify the hash on the L2 when retrieving the message.
        // Luckily for us, the GigaRoot is the size of a Field so we don't have to hash it
        // and can directly retrieve it on the L2.
        bytes32 contentHash = bytes32(_newGigaRoot);

        // `secret` is used to make the consumption of a message on the L2 private.
        // we don't care about keeping message consumption private at all so to
        // simplify things we hardcode the secret as 0 in the noir side and hardcode
        // Hash(0) here in the L1
        bytes32 secretHash = 0x001dc7b0244cb71a4609d526300ba6771064bd046848666f7bfe577053d630c5;

        // Send message to rollup
        (bytes32 key, uint256 index) = inbox.sendL2Message(
            actor,
            contentHash,
            secretHash
        );

        // Emit event
        emit NewGigaRootSentToAztec(contentHash, key, index);
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

    /**
     * @notice gets the L2 root from the portal
     * @dev Second part of getting the L2 root to L1, must be initiated from L2 first as it will consume a message from outbox
     * @param _newL2Root - the merkle root currently on the L2 to add into the GigaRoot
     * @param _bridgedL2BlockNumber - the block number that is in the content hash (should exactly match the block _newL2Root is from)
     * @param _witnessL2BlockNumber - the block number where we retrieve the message proof from (should exactly match the block at which the witness (aka _path) is retrieved )
     * @param _leafIndex - The amount to withdraw
     * @param _path - Must match the caller of the message (specified from L2) to consume it.
     */
    function getNewRootFromL2(
        bytes32 _newL2Root,
        uint256 _bridgedL2BlockNumber,
        uint256 _witnessL2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external {
        // this hash should match the hash created on the aztec side of this root bridge
        // adapter
        bytes32 contentHash = getContentHash(_newL2Root, _bridgedL2BlockNumber);

        DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
            sender: DataStructures.L2Actor(l2AztecBridgeAdapter, rollupVersion),
            recipient: DataStructures.L1Actor(address(this), block.chainid),
            content: contentHash
        });

        outbox.consume(message, _witnessL2BlockNumber, _leafIndex, _path);//@TODO @jimjim remove + 1 see if it breaks

        // convert from bytes32 to uint256
        uint256 newL2RootCast = uint256(_newL2Root);

        emit ReceivedNewL2Root(newL2RootCast, _bridgedL2BlockNumber);

        mostRecentL2Root = newL2RootCast;
        mostRecentL2RootBlockNumber = _bridgedL2BlockNumber;
    }

    // hashes _newL2Root and _l2BlockNumber so it's representation can fit inside of a
    // Field element.  This should match how they are hashed in the Aztec side of this bridge
    // adapter
    function getContentHash(
        bytes32 _newL2Root,
        uint256 _bridgedL2BlockNumber
    ) public pure returns (bytes32) {
        return Hash.sha256ToField(abi.encode(_newL2Root, _bridgedL2BlockNumber));
    }
}
