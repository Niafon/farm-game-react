// Hardhat config for Monad Testnet
// Uses chain settings provided via .env (shared with Vite)
require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');
// Optional: Ignition (ethers-based) for declarative deploys
try { require('@nomicfoundation/hardhat-ignition-ethers'); } catch {}
// Optional: coverage & gas reporter (activated via env)
try { require('solidity-coverage'); } catch {}
try { require('hardhat-gas-reporter'); } catch {}

const MONAD_RPC_URL = process.env.VITE_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RAW_CHAIN_ID = process.env.VITE_MONAD_CHAIN_ID || '10143';

// Accept decimal or hex in env and normalize to number
const CHAIN_ID = RAW_CHAIN_ID.toString().startsWith('0x')
  ? parseInt(RAW_CHAIN_ID, 16)
  : parseInt(RAW_CHAIN_ID, 10);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.20',
  gasReporter: process.env.REPORT_GAS ? {
    enabled: true,
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: [],
    showTimeSpent: true,
    noColors: true,
  } : undefined,
  etherscan: process.env.BLOCK_EXPLORER_API_URL ? {
    apiKey: {
      // For Blockscout-based explorers an arbitrary string is accepted
      monad: process.env.BLOCK_EXPLORER_API_KEY || 'blockscout'
    },
    customChains: [
      {
        network: 'monad',
        chainId: CHAIN_ID,
        urls: {
          apiURL: process.env.BLOCK_EXPLORER_API_URL,
          browserURL: process.env.BLOCK_EXPLORER_BROWSER_URL || process.env.BLOCK_EXPLORER_API_URL?.replace(/\/api.*/, '')
        }
      }
    ]
  } : undefined,
  networks: {
    monad: {
      url: MONAD_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: CHAIN_ID,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  mocha: {
    timeout: 60000,
  },
};


