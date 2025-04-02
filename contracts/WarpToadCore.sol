// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {PoseidonT3} from "poseidon-solidity/PoseidonT3.sol";
import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// tutorial https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/lean-imt/contracts/test/LeanIMTTest.sol
// noir equivalent (normal merkle tree): https://github.com/privacy-scaling-explorations/zk-kit.noir/tree/main/packages/merkle-trees 
// ts/js: https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt

contract WarpToadCore is ERC20 { // TODO erc20
    LeanIMTData public commitTreeData;
    uint256 public maxTreeDepth;

    uint256 public maxBurns;
    uint256 public totalBurns;

    uint256 public gigaRoot;
    mapping(uint256 => bool ) public gigaRootHistory; // limiting the history so we override slots is more efficient

    constructor(uint256 _maxDepth) ERC20("WarpToad","WRPTD_") { 
        maxTreeDepth = _maxDepth;
        maxBurns = 2 ** _maxDepth; // circuit cant go above this number
    }

    function isValidGigaRoot(uint256 _gigaRoot) public view returns(bool) {
        return gigaRootHistory[_gigaRoot];
    }
    
    function burn(uint256 _preCommitment, uint256 _amount) public {
        require(totalBurns < maxBurns, "Tree wil exceed the maxTreeDepth");
        //TODO burn erc20
        uint256 commitment = PoseidonT3.hash([_preCommitment, _amount]);
        LeanIMT.insert(commitTreeData, commitment);
        totalBurns += 1;
    }

    function mint(uint256 _amount, uint256 _gigaRoot, bytes memory _poof) public {
        // TODO mint erc20
        // TODO verify proof
        // TODO check if _gigaRoot history
    }

    function indexOf(uint256 leaf) public view returns (uint256) {
        return LeanIMT.indexOf(commitTreeData, leaf);
    }

    function root() public view returns (uint256) {
        return LeanIMT.root(commitTreeData);
    }
}


/* notes:
you can make recursive proofs of proving chainRoot -> gigaRoot. And just save them somewhere to speed up proof time
root and indexOf might need a more specific name since this contract will be extended with gigaTree on L1 and gigaRoot on L2's
*/