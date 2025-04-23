// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LazyIMT, LazyIMTData} from "@zk-kit/lazy-imt.sol/LazyIMT.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWarpToadCore} from "./interfaces/IWarpToadCore.sol";
// tutorial https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/lean-imt/contracts/test/LazyIMTTest.sol
// noir equivalent (normal merkle tree): https://github.com/privacy-scaling-explorations/zk-kit.noir/tree/main/packages/merkle-trees
// ts/js: https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt

interface IVerifier {
    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}

abstract contract WarpToadCore is ERC20, IWarpToadCore {
    LazyIMTData public commitTreeData; // does this need to be public?
    uint8 public maxTreeDepth;

    uint256 public gigaRoot;
    mapping(uint256 => bool) public gigaRootHistory; // TODO limit the history so we override slots is more efficient and is easier for clients to implement contract interactions
    mapping(uint256 => bool) public localRootHistory; 

    address public gigaBridge;
    address public withdrawVerifier;

    uint256 public lastLeafIndex;

    constructor(uint8 _maxTreeDepth, address _gigaBridge, address _withdrawVerifier) {
        maxTreeDepth = _maxTreeDepth;
        // maxBurns = 2 ** _maxTreeDepth; // circuit cant go above this number

        gigaBridge = _gigaBridge;
        withdrawVerifier = _withdrawVerifier;
        LazyIMT.init(commitTreeData, _maxTreeDepth);
    }

    function receiveGigaRoot(uint256 _gigaRoot) public {
        require(
            msg.sender == gigaBridge,
            "only gigaBridge can send the gigaRoot"
        );
        gigaRootHistory[_gigaRoot] = true;
        gigaRoot = _gigaRoot;
    }

    function isValidGigaRoot(uint256 _gigaRoot) public view returns (bool) {
        return gigaRootHistory[_gigaRoot];
    }

    function burn(uint256 _preCommitment, uint256 _amount) public {
        //require(totalBurns < maxBurns, "Tree wil exceed the maxTreeDepth");

        _burn(msg.sender, _amount);

        uint256 _commitment = PoseidonT3.hash([_preCommitment, _amount]);
        LazyIMT.insert(commitTreeData, _commitment);
        emit Burn(_commitment, _amount, lastLeafIndex);
        lastLeafIndex++;
    }

    // our tree is lazy so we 
    function storeLocalRootInHistory() public returns(uint256) {
        uint256 root = localRoot();
        localRootHistory[root] = true;
        return root;
    }

    function _formatPublicInputs(        
        uint256 _nullifier,
        uint256 _chainId,
        uint256 _amount,
        uint256 _gigaRoot,
        uint256 _localRoot,
        uint256 _feeFactor,
        uint256 _priorityFee,
        uint256 _maxFee,
        address _relayer,
        address _recipient
    ) public view returns (bytes32[] memory) {
        bytes32[] memory publicInputs = new bytes32[](10);
        // TODO is this expensive gas wise?
        uint256[8] memory uintInputs = [_nullifier,_chainId,_amount,_gigaRoot,_localRoot,_feeFactor,_priorityFee,_maxFee];
        address[2] memory addressInputs = [_relayer, _recipient];
        
        for (uint i = 0; i < uintInputs.length; i++) {
            publicInputs[i] = bytes32(uintInputs[i]);
        }
        uint256 indexAfterUints = uintInputs.length; 
        for (uint i = 0; i < 2; i++) {
            publicInputs[indexAfterUints + i] = bytes32(uint256(uint160(bytes20(addressInputs[i])))); // silly ah solidity way to get left padded 32bytes hopefully the compiler doesn't make it look silly
        }
        return publicInputs;
    }


    // TODO relayer support
    function mint(
        uint256 _nullifier,
        uint256 _amount,
        uint256 _gigaRoot,
        uint256 _localRoot,
        uint256 _feeFactor,
        uint256 _priorityFee,
        uint256 _maxFee,
        address _relayer,
        address _recipient,
        bytes memory _poof
    ) public {
        require(isValidGigaRoot(_gigaRoot), "_gigaRoot unknown");
        require(isValidLocalRoot(_localRoot), "_localRoot unknown"); 
        
        bytes32[] memory _publicInputs = _formatPublicInputs(_nullifier, block.chainid, _amount, _gigaRoot, _localRoot, _feeFactor, _priorityFee, _maxFee, _relayer, _recipient);
        require(IVerifier(withdrawVerifier).verify(_poof, _publicInputs), "invalid proof"); 

        // fee logic       
        if (_feeFactor != 0 ) { 
            uint256 _relayerFee = _feeFactor * (block.basefee + _priorityFee); // TODO double check precision. Prob only breaks if the wrpToad token price is super high or gas cost super low
            require(_relayerFee <= _maxFee, "_relayerFee is larger than _maxFee");
            // for compatibility with permissionless relaying
            if (_relayer == address(1)){
                _relayer = msg.sender;
            }
            _mint(_relayer, _relayerFee);
            _mint(_recipient, _amount - _relayerFee);
        } else {
            // its self relayed or relayer is just nice :D
            _mint(_recipient, _amount);
        }
    }

    // function indexOf(uint256 leaf) public view returns (uint256) {
    //     return LazyIMT.indexOf(commitTreeData, leaf);
    // }

    function localRoot() public view returns (uint256) {
        return LazyIMT.root(commitTreeData, maxTreeDepth);
    }

    function isValidLocalRoot(uint256 _localRoot) public view returns (bool) {
        return localRootHistory[_localRoot];
    }
}

/* notes:

you can make recursive proofs of proving chainRoot -> gigaRoot. 
And just save them somewhere to speed up proof time
root and indexOf might need a more specific name since this contract will 
be extended with gigaTree on L1 and gigaRoot on L2's

gigaRoot will only update with deposits made at the current chain if it is 
bridged to L1 and back to L2 first which sucks for those who want to withdraw on the same chain they deposited at

*/
