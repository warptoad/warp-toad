// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {LeanIMT, LeanIMTData} from "@zk-kit/lean-imt.sol/LeanIMT.sol";
// tutorial https://github.com/privacy-scaling-explorations/zk-kit.solidity/blob/main/packages/lean-imt/contracts/test/LeanIMTTest.sol
// noir equivalent (normal merkle tree): https://github.com/privacy-scaling-explorations/zk-kit.noir/tree/main/packages/merkle-trees 
// ts/js: https://github.com/privacy-scaling-explorations/zk-kit/tree/main/packages/lean-imt

contract WarpToadCore { // TODO erc20
    LeanIMTData public commitTreeData;
    uint256 public maxTreeDepth;
    uint256 public maxBurns;
    uint256 public totalBurns;

    constructor(uint256 _maxDepth) { 
        maxTreeDepth = _maxDepth;
        maxBurns = 2 ** _maxDepth; // circuit cant go above this number
    }
    
    function burn(uint256 _preCommitment, uint256 _amount) public {
        require(totalBurns < maxBurns, "Tree wil exceed the maxTreeDepth");
        //TODO burn erc20
        //TODO hash commitment=hash(_preCommitment,amount)
        uint256 leaf = _preCommitment; // remove this. Its wrong!!
        LeanIMT.insert(commitTreeData, leaf);
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