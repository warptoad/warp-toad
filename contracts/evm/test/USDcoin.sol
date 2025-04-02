// SPDX-License-Identifier: MIT 
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract USDcoin is ERC20 { 
    constructor() ERC20("USD Coin", "USDC"){}

    function getFreeShit(uint256 _amount) public {
        _mint( msg.sender, _amount);
    }
}