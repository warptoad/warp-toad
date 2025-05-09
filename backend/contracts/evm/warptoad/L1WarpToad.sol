// SPDX-License-Identifier: MIT

pragma solidity 0.8.29;

import {WarpToadCore} from "./WarpToadCore.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract L1WarpToad is WarpToadCore {
    constructor(uint8 _maxTreeDepth, address _withdrawVerifier, address _nativeToken, string memory name, string memory symbol) 
    ERC20(name, symbol) 
    WarpToadCore(_maxTreeDepth, _withdrawVerifier, _nativeToken)  {
    }

    function wrap(uint256 _amount) public {
        IERC20(nativeToken).transferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, _amount);
        // TODO event?
    }

    function unwrap(uint256 _amount) public {
        IERC20(nativeToken).transfer(msg.sender, _amount);
        _burn(address(this), _amount);
        // TODO event?
    }
}