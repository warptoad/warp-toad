import {WarpToadCore} from "./WarpToadCore.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract L1WarpToad is WarpToadCore {
    address nativeToken;

    //@joss do what ever to the structure or naming or things if u feel like it
    constructor(uint8 _maxTreeDepth, address _gigaBridge,address _nativeToken, string memory name, string memory symbol) 
    ERC20(name, symbol) 
    WarpToadCore(_maxTreeDepth, _gigaBridge)  {
        nativeToken = _nativeToken;
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

    function receiveL2Root(uint256 _root, uint256 _chainId) public {
         require(msg.sender == gigaBridge, "only gigaBridge can send a L2 root");
        //TODO
    }

    function bridgeGigaRoot() public {
        uint256 _gigaRoot = _calculateGigaRoot();
        gigaRoot = _gigaRoot;
        //TODO interact with the gigaBridge
    }

    function _calculateGigaRoot() private returns(uint256) {
        localRoot(); // <- returns the root!
        //TODO make new tree
    }
}