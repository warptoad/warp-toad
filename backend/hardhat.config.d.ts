import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";
declare const config: {
    mocha: {
        timeout: number;
    };
    solidity: {
        version: string;
        settings: {
            optimizer: {
                enabled: boolean;
                runs: number;
            };
            evmVersion: string;
        };
    };
    paths: {
        sources: string;
        tests: string;
        cache: string;
        artifacts: string;
    };
    networks: {
        aztecSandbox: {
            url: string;
            accounts: string[];
        };
        sepolia: {
            url: string;
            accounts: string[];
            chainId: number;
            ethNetwork: string;
        };
        scrollSepolia: {
            url: string;
            accounts: string[];
            chainId: number;
        };
    };
    etherscan: {
        apiKey: string;
        customChains: {
            network: string;
            chainId: number;
            urls: {
                apiURL: string;
                browserURL: string;
            };
        }[];
    };
    sourcify: {
        enabled: boolean;
    };
};
export default config;
//# sourceMappingURL=hardhat.config.d.ts.map