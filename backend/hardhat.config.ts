import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

// Resolve testnet RPC URLs / deployer key from process.env. The deploy script
// is invoked via `dotenv -e .env -- hardhat run ...` (see deploy:testnet in
// package.json), so by the time this config evaluates, the .env vars are
// already in process.env. Hardhat 3's `configVariable()` is NOT used here
// because it reads from an encrypted keystore by default, not env vars.
//
// Hardhat 3 strict-validates the network config at every command (even
// `hardhat compile`), so an empty URL string makes it fail with HHE15. We
// fall back to `http://localhost:8545` as a syntactically valid placeholder
// that's only used if you explicitly target the testnet network without
// having set the env var. Compile / test / unrelated commands run unaffected.
const PLACEHOLDER_URL = "http://localhost:8545";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || PLACEHOLDER_URL;
const SCROLL_SEPOLIA_RPC_URL = process.env.SCROLL_SEPOLIA_RPC_URL || PLACEHOLDER_URL;
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

const DEFAULT_PRIV_KEYS_ANVIL = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];

export default defineConfig({
  defaultNetwork: "local",
  solidity: {
    // Hardhat 3 has two build profiles: `default` and `production`. Ignition
    // defaults to `production`, and Hardhat's `copyFromDefault` drops the user
    // `settings` block when synthesizing the production profile from a single
    // version config, replacing optimizer with `{ enabled: true, runs: 200 }`.
    // We need runs=1 to keep HonkVerifier under EIP-170's 24,576-byte limit
    // on Sepolia/Scroll Sepolia/mainnet, so we declare both profiles explicitly
    // with the same settings (the verifier is called rarely, so the slight
    // gas-cost bump from low optimizer runs is fine).
    profiles: {
      default: {
        version: "0.8.29",
        settings: {
          optimizer: { enabled: true, runs: 1 },
          evmVersion: "cancun",
        },
      },
      production: {
        version: "0.8.29",
        settings: {
          optimizer: { enabled: true, runs: 1 },
          evmVersion: "cancun",
        },
      },
    },
    npmFilesToBuild: [
      "poseidon-solidity/PoseidonT3.sol",
      // Ignition's L1WarpToad / L2Scroll modules call m.library("LazyIMT", ...)
      // which requires Hardhat to have compiled LazyIMT into its artifacts.
      "@zk-kit/lazy-imt.sol/LazyIMT.sol",
    ],
  },
  plugins: [hardhatToolboxViem],
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    // Override the default "./ignition". All ignition modules and deployment
    // state live under deploy/ignition/, alongside the Aztec deploy outputs in
    // deploy/aztec/, so both halves of the cross-chain deploy live together.
    ignition: "./deploy/ignition",
  },
  networks: {
    // Points at the Aztec sandbox's bundled anvil so warp-toad's L1 contracts
    // share an L1 with the Aztec rollup/outbox/inbox. Required for the cross-chain
    // burn/mint tests to work end-to-end. Start the sandbox first: `aztec start --local-network`.
    local: {
      type: "http",
      chainType: "l1",
      url: "http://localhost:8545",
      chainId: 31337,
      accounts: DEFAULT_PRIV_KEYS_ANVIL,
    },
    // In-process EDR L1, kept around for tests that don't need an external L1.
    edr: {
      type: "edr-simulated",
      chainType: "l1",
      allowUnlimitedContractSize: true,
      accounts: DEFAULT_PRIV_KEYS_ANVIL.map((key) => ({
        privateKey: key,
        balance: "10000000000000000000000",
      })),
    },
    sepolia: {
      type: "http",
      url: SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    scrollSepolia: {
      type: "http",
      url: SCROLL_SEPOLIA_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 534351,
    },
  },
  // Scroll Sepolia isn't in Hardhat 3's default chain descriptors, so add it
  // here. Sepolia (11155111) is in defaults already and inherits etherscan.io.
  chainDescriptors: {
    534351: {
      name: "Scroll Sepolia",
      blockExplorers: {
        etherscan: {
          url: "https://sepolia.scrollscan.com",
          apiUrl: "https://api-sepolia.scrollscan.com/api",
        },
        blockscout: {
          url: "https://scroll-sepolia.blockscout.com",
          apiUrl: "https://scroll-sepolia.blockscout.com/api",
        },
      },
    },
  },
  // Etherscan v2 unified API key (one key for Sepolia + Scroll Sepolia).
  // Set ETHERSCAN_API_KEY in backend/.env. Verification is invoked by the
  // deploy orchestrator via `hardhat ignition verify <deploymentId>`.
  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API_KEY,
    },
  },
});
