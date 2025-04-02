import "@nomicfoundation/hardhat-toolbox";
import { vars } from "hardhat/config.js";
const PRIVATE_KEY = vars.get("PRIVATE_KEY");
const DEFAULT_PRIV_KEY_ANVIL = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


export default {
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
      url: "http://localhost:8545" || "",
      accounts:
        [DEFAULT_PRIV_KEY_ANVIL]
    },
  }
}
