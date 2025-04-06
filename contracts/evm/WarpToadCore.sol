// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {BinaryIMT, BinaryIMTData} from "@zk-kit/imt.sol/BinaryIMT.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWarpToadCore} from "./interfaces/IWarpToadCore.sol";
// tutorial https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/lean-imt/contracts/test/LeanIMTTest.sol
// noir equivalent (normal merkle tree): https://github.com/privacy-scaling-explorations/zk-kit.noir/tree/main/packages/merkle-trees
// ts/js: https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt

abstract contract WarpToadCore is ERC20, IWarpToadCore {
    BinaryIMTData public localTreeData;
    uint8 public maxTreeDepth;

    // uint256 public maxBurns;
    // uint256 public totalBurns;

    uint256 public gigaRoot;
    mapping(uint256 => bool) public gigaRootHistory; // limiting the history so we override slots is more efficient
    mapping(uint256 => bool) public localRootHistory; // limiting the history so we override slots is more efficient
 
    address gigaBridge;

    constructor(uint8 _maxTreeDepth, address _gigaBridge) {
        maxTreeDepth = _maxTreeDepth;
        // maxBurns = 2 ** _maxTreeDepth; // circuit cant go above this number

        gigaBridge = _gigaBridge;
        BinaryIMT.init(localTreeData, _maxTreeDepth, 0);
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
        // require(totalBurns < maxBurns, "Tree wil exceed the maxTreeDepth");

        _burn(msg.sender, _amount);

        uint256 _commitment = PoseidonT3.hash([_preCommitment, _amount]);
        BinaryIMT.insert(localTreeData, _commitment);
        localRootHistory[localRoot()] = true;
        //totalBurns += 1;
        emit Burn(_commitment, _amount);
    }

    // TODO relayer support
    function mint(
        address _recipient,
        uint256 _amount,
        uint256 _gigaRoot,
        uint256 _localRoot,
        bytes memory _poof
    ) public {
        require(isValidGigaRoot(_gigaRoot), "_gigaRoot unknown");
        require(isValidLocalRoot(_localRoot), "_localRoot unknown");
        _mint(_recipient, _amount);
        // TODO verify proof
        // verify(_gigaRoot, root(), _amount, _recipient)
    }

    function localRoot() public view returns (uint256) {
        //return BinaryIMT.root(localTreeData);
        return localTreeData.root;
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
