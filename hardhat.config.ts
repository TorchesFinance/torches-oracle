
import 'dotenv/config'
import "@nomiclabs/hardhat-etherscan"
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-contract-sizer'
import 'hardhat-abi-exporter'
import 'solidity-coverage'
import "hardhat-spdx-license-identifier"
import "hardhat-deploy"
import "hardhat-deploy-ethers"

import { HardhatUserConfig } from "hardhat/types"

const accounts = {
    mnemonic: process.env.MNEMONIC,
};

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config: HardhatUserConfig = {
  abiExporter: {
    path: './abi',
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  typechain: {
    outDir: './typechain',
    target: 'ethers-v5',
  },
  defaultNetwork: "hardhat",
  mocha: {
      timeout: 20000,
  },
  namedAccounts: {
      deployer: {
          default: 0,
      },
      dev: {
          // Default to 1
          default: 0,
      },
      treasury: {
          default: 1,
      },
      investor: {
          default: 2,
      },
  },
  networks: {
    hardhat:{

    },
    km: {
        url: "https://rpc-mainnet.kcc.network",
        accounts,
        chainId: 321,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
        gasMultiplier: 2,
        blockGasLimit: 300000
    },
    kt: {
        url: "https://rpc-testnet.kcc.network",
        accounts,
        chainId: 322,
        live: true,
        saveDeployments: true,
        tags: ["staging"],
        timeout: 4000000,
        gasMultiplier: 2,
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts,
      chainId: 80001,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 4,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
           optimizer: {
             enabled: true,
             runs: 20000,
           },
        },
      },
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      ropsten: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
      goerli: process.env.ETHERSCAN_API_KEY,
      kovan: process.env.ETHERSCAN_API_KEY,
      // binance smart chain
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
      // huobi eco chain
      heco: "YOUR_HECOINFO_API_KEY",
      hecoTestnet: "YOUR_HECOINFO_API_KEY",
      // fantom mainnet
      opera: process.env.FTMSCAN_API_KEY,
      ftmTestnet: process.env.FTMSCAN_API_KEY,
      // optimism
      optimisticEthereum: "YOUR_OPTIMISTIC_ETHERSCAN_API_KEY",
      optimisticKovan: "YOUR_OPTIMISTIC_ETHERSCAN_API_KEY",
      // polygon
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY,
      // arbitrum
      arbitrumOne: "YOUR_ARBISCAN_API_KEY",
      arbitrumTestnet: "YOUR_ARBISCAN_API_KEY",
      // avalanche
      avalanche: process.env.SNOWTRACE_API_KEY,
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY,
      // moonbeam
      moonbeam: "YOUR_MOONBEAM_MOONSCAN_API_KEY",
      moonriver: "YOUR_MOONRIVER_MOONSCAN_API_KEY",
      moonbaseAlpha: "YOUR_MOONBEAM_MOONSCAN_API_KEY",
      // xdai and sokol don't need an API key, but you still need
      // to specify one; any string placeholder will work
      xdai: "api-key",
      sokol: "api-key",
    }
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: false,
    disambiguatePaths: false,
  },
}

export default config