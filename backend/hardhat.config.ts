import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config.js";
//import { HardhatUserConfig } from "hardhat/config";

//cjs shit
// require( "@nomicfoundation/hardhat-toolbox")
// const { vars } = require("hardhat/config.js");

const PRIVATE_KEY = vars.get("PRIVATE_KEY");
const DEFAULT_PRIV_KEY_ANVIL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


const config = {
  solidity: {
    version: "0.8.29",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
      evmVersion: "cancun"
    },
  },


  networks: {
    aztecSandbox: {
      url: "http://localhost:8545",
      accounts:
        [DEFAULT_PRIV_KEY_ANVIL]
    },
  }
}
//cjs shit
//module.exports = config;
export default config;
