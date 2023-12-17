import { ethers } from "ethers";
ethers.BigNumber.prototype.toJSON = function toJSON(_key:any) { return this.toString() };
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-abi-exporter";
import "hardhat-contract-sizer";
import { config as dotenv_config } from "dotenv";
dotenv_config();
const USE_PROCESSED_FILES = process.env.USE_PROCESSED_FILES === "true";

const ethereum_fork = { url: process.env.ETHEREUM_URL||'', blockNumber:parseInt(process.env.ETHEREUM_FORK_BLOCK)||undefined };
const goerli_fork = { url: process.env.GOERLI_URL||'', blockNumber:parseInt(process.env.GOERLI_FORK_BLOCK)||undefined };
const sepolia_fork = { url: process.env.SEPOLIA_URL||'', blockNumber:parseInt(process.env.SEPOLIA_FORK_BLOCK)||undefined };
const polygon_fork = { url: process.env.POLYGON_URL||'', blockNumber:parseInt(process.env.POLYGON_FORK_BLOCK)||undefined };
const mumbai_fork = { url: process.env.MUMBAI_URL||'', blockNumber:parseInt(process.env.MUMBAI_FORK_BLOCK)||undefined };
const base_fork = { url: process.env.BASE_URL||'', blockNumber:parseInt(process.env.BASE_FORK_BLOCK)||undefined }
const base_goerli_fork = { url: process.env.BASE_GOERLI_URL||'', blockNumber:parseInt(process.env.BASE_GOERLI_FORK_BLOCK)||undefined };
const no_fork = undefined;
const forking = (
    process.env.FORK_NETWORK === "ethereum"       ? ethereum_fork
  : process.env.FORK_NETWORK === "goerli"         ? goerli_fork
  : process.env.FORK_NETWORK === "sepolia"        ? sepolia_fork
  : process.env.FORK_NETWORK === "polygon"        ? polygon_fork
  : process.env.FORK_NETWORK === "mumbai"         ? mumbai_fork
  : process.env.FORK_NETWORK === "base"           ? base_fork
  : process.env.FORK_NETWORK === "basegoerli"     ? base_goerli_fork
  : no_fork
);

const accounts = JSON.parse(process.env.PRIVATE_KEYS || '[]');

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: process.env.FORK_NETWORK ? forking : undefined,
      hardfork: "merge",
      allowUnlimitedContractSize: true,
    },
    localhost: { url: "http://127.0.0.1:8545" },
    ethereum: {
      url: process.env.ETHEREUM_URL||'',
      chainId: 1,
      accounts: accounts
    },
    goerli: {
      url: process.env.GOERLI_URL||'',
      chainId: 5,
      accounts: accounts
    },
    sepolia: {
      url: process.env.SEPOLIA_URL||'',
      chainId: 111555111,
      accounts: accounts
    },
    polygon: {
      url: process.env.POLYGON_URL||'',
      chainId: 137,
      accounts: accounts
    },
    mumbai: {
      url: process.env.MUMBAI_URL||'',
      chainId: 80001,
      accounts: accounts,
      hardfork: "merge"
    },
    base: {
      url: process.env.BASE_URL||'',
      chainId: 8453,
      accounts: accounts
    },
    basegoerli: {
      url: process.env.BASE_GOERLI_URL||'',
      chainId: 84531,
      accounts: accounts
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1,
          },
        },
      },
    ]
  },
  paths: {
    sources: USE_PROCESSED_FILES ? "./contracts_processed" : "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  abiExporter: {
    path: "./client/src/constants/abi",
    clear: true,
    flat: false,
    only: [],
    spacing: 2,
  },
  mocha: {
    timeout: 3600000, // one hour
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    gasPrice: 1, // really should be ~0.001 gwei, but this doesnt support decimals
    coinmarketcap: process.env.CMC_API_KEY || "",
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli:  process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      "base-goerli": "PLACEHOLDER_STRING"
     },
     customChains: [
       {
         network: "base",
         chainId: 8453,
         urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
         }
       },
       {
         network: "base-goerli",
         chainId: 84531,
         urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
         }
       }
     ]
  }
};
//console.log("config")
//console.log(config)

export default config;
