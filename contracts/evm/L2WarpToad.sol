import {WarpToadCore} from "./WarpToadCore.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract L2WarpToad is WarpToadCore {
    //@joss do what ever to the structure or naming or things if u feel like it
    constructor(uint256 _maxTreeDepth, address _gigaBridge, string memory name, string memory symbol) 
    ERC20(name, symbol) 
    WarpToadCore(_maxTreeDepth, _gigaBridge)  {
    }

    function bridgeRoot() public {
        localRoot(); // <- returns the localRoot!
        //TODO interact with the gigaBridge
    }
}