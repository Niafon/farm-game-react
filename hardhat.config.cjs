// Hardhat config for Monad Testnet
// Uses chain settings provided via .env (shared with Vite)
require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

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


