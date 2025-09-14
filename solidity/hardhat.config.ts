import type { HardhatUserConfig } from "hardhat/config"

import "@nomicfoundation/hardhat-toolbox"
import "hardhat-contract-sizer"
import "hardhat-deploy"
import "hardhat-dependency-compiler"
import "solidity-docgen"
import "@keep-network/hardhat-helpers"
import dotenv from "dotenv-safer"

dotenv.config({
  allowEmptyValues: true,
  example: process.env.CI ? ".env.ci.example" : ".env.example",
})

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL ?? ""

const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY
  ? [process.env.MAINNET_PRIVATE_KEY]
  : []

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? ""

const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY
  ? [process.env.SEPOLIA_PRIVATE_KEY]
  : []

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? ""

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY ?? ""

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },

  paths: {
    artifacts: "./build",
  },

  networks: {
    hardhat: {
      // Set fixed initialBaseFeePerGas to avoid issues with maxFeePerGas
      // being too low fo the next block.
      initialBaseFeePerGas: 1000000000,
      forking: (() => {
        if (process.env.FORKING === "true") {
          return {
            url: MAINNET_RPC_URL,
            // Points to the mainnet block that has a state important for the
            // integration tests:
            // 20971177 - the block where AcreMultiAssetVault was deployed in
            // transaction:
            // https://etherscan.io/tx/0x2ae30e59643e70aa074bdef089b2cd76dc2a4bf5ee5fa671c8fca9d5f37e022f
            blockNumber: 20971177,
          }
        }
        if (process.env.SEPOLIA_FORKING === "true") {
          return {
            url: SEPOLIA_RPC_URL,
            // Use a recent Sepolia block for testing
            blockNumber: process.env.SEPOLIA_BLOCK_NUMBER
              ? parseInt(process.env.SEPOLIA_BLOCK_NUMBER, 10)
              : undefined,
          }
        }
        return undefined
      })(),
    },
    integration: {
      url: "http://localhost:8545",
    },
    "sepolia-integration": {
      url: "http://localhost:8545",
      chainId: 11155111,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts: SEPOLIA_PRIVATE_KEY,
      tags: ["etherscan"],
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      chainId: 1,
      accounts: MAINNET_PRIVATE_KEY,
      tags: ["etherscan"],
    },
  },

  dependencyCompiler: {
    paths: ["@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol"],
    // Keep the source files after compilation. Removing the source files
    // causes slither to fail.
    keep: true,
  },

  external: {
    deployments: {
      sepolia: ["./external/sepolia"],
      mainnet: ["./external/mainnet"],
      integration: ["./external/mainnet", "./deployments/mainnet"],
      "sepolia-integration": ["./external/sepolia", "./deployments/sepolia"],
    },
  },

  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
    },
  },

  namedAccounts: {
    deployer: {
      default: 1,
      sepolia: 0,
      mainnet: "0x2B56435eD740C555573fB5CE60840E1E74a7cDC4",
    },
    governance: {
      default: 2,
      sepolia: 0,
      mainnet: "0x790Dda4c56b3c45d0e4514eDbAaBa30D7129c857",
      integration: "0x790Dda4c56b3c45d0e4514eDbAaBa30D7129c857",
    },
    treasury: {
      default: 3,
      sepolia: 0,
      mainnet: "0xb0d97781D70A8ebD0cd8bFbE79AbC5545B829fc5",
      integration: "0xb0d97781D70A8ebD0cd8bFbE79AbC5545B829fc5",
    },
    maintainer: {
      default: 4,
      sepolia: "0x5CD05b073Ed2d01991A46cd55dA5D10a63B1E2CA",
      mainnet: "0x373C177845cEfaB4Ed85666b99c9fDB40ae7Cd19",
      integration: "0x373C177845cEfaB4Ed85666b99c9fDB40ae7Cd19",
    },
    pauseAdmin: {
      default: 5,
      sepolia: 0,
      mainnet: "0x1299C7432034d1B85e148a2033d571a9B578292B",
      integration: "0x1299C7432034d1B85e148a2033d571a9B578292B",
    },
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    strict: true,
  },

  gasReporter: {
    enabled: true,
    coinmarketcap: COINMARKETCAP_API_KEY,
  },

  typechain: {
    outDir: "typechain",
  },

  docgen: {
    outputDir: "./gen/docs",
    pages: "files",
    exclude: ["external/", "test/"],
    collapseNewlines: true,
  },
}

export default config
