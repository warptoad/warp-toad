import "@nomicfoundation/hardhat-toolbox";
//@ts-ignore
import { vars } from "hardhat/config.js";
//import { HardhatUserConfig } from "hardhat/config";

//cjs shit
// require( "@nomicfoundation/hardhat-toolbox")
// const { vars } = require("hardhat/config.js");

const SEPOLIA_URL = vars.get("SEPOLIA_URL")
const PRIVATE_KEY = vars.get("PRIVATE_KEY");
const DEFAULT_PRIV_KEYS_ANVIL = ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba", "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356", "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97", "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"]
const ETHERSCAN_KEY = vars.get("ETHERSCAN_KEY");
const ETHERSCAN_KEY_SCROLL = vars.get("ETHERSCAN_KEY_SCROLL");

const config = {
  mocha: {
    timeout: 600000, // 10 minutes for tests
  },
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

  paths: {
    sources: "./contracts",//"../",//["../node_modules/@zk-kit", "./contracts"],
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  networks: {
    aztecSandbox: {
      url: "http://localhost:8545",
      accounts:
        DEFAULT_PRIV_KEYS_ANVIL
    },

    sepolia: {
      url: SEPOLIA_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      ethNetwork: "sepolia",
    },

    scrollSepolia: {
      url: "https://sepolia-rpc.scroll.io/",
      accounts: [PRIVATE_KEY],
      chainId: 534351,
    }
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_KEY,
      scrollSepolia: ETHERSCAN_KEY_SCROLL
    },
    customChains: [
      {
        network: 'scrollSepolia',
        chainId: 534351,
        urls: {
          apiURL: 'https://api-sepolia.scrollscan.com/api',
          browserURL: 'https://sepolia.scrollscan.com/',
        },
      },
      // {
      //   network: 'sepolia',
      //   chainId: 11155111,
      //   urls: {
      //     apiURL: 'https://api.etherscan.io/v2/api?chainid=11155111',
      //     browserURL: 'https://sepolia.etherscan.io/',
      //   },
      // }
    ]
  },
}
//cjs shit
//module.exports = config;
export default config;
