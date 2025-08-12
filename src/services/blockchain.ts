import type { BrowserProvider, Contract, Eip1193Provider } from 'ethers';
import { CONTRACT_ADDRESS } from '../config';

export type EthersModule = typeof import('ethers');

export async function loadEthers(): Promise<EthersModule> {
  return import('ethers');
}

export function isSafeProvider(provider?: Eip1193Provider): boolean {
  if (!provider) return false;
  const eth = provider as unknown as { request?: unknown };
  return typeof eth.request === 'function';
}

export function getInjectedProvider(): Eip1193Provider | undefined {
  const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  return eth && isSafeProvider(eth) ? eth : undefined;
}

export async function ensureNetwork(_provider: Eip1193Provider): Promise<void> {
  // No-op to disable automatic network switching per requirements
}

export async function connectWallet(ethers: EthersModule, provider: Eip1193Provider) {
  const [account] = await provider.request({ method: 'eth_requestAccounts' });
  const browserProvider = new ethers.BrowserProvider(provider);
  const signer = await browserProvider.getSigner();
  const abi = [
    'function setGameState(string state)',
    'function getGameState(address player) view returns (string)',
    'function plant(uint256 bedIndex)',
    'function water(uint256 bedIndex)',
    'function harvest(uint256 bedIndex)',
    'function batchPlant(uint256[] bedIndices)',
    'function batchWater(uint256[] bedIndices)',
    'function batchHarvest(uint256[] bedIndices)',
    'function exchangeWheat(uint256 wheatAmount)',
    'function buyExpansion()',
    'function getFullState(address player) view returns (string)',
    'event StateDelta(address indexed player)',
  ];
  let contract: Contract | undefined = undefined;
  if (CONTRACT_ADDRESS && !/^0x0{40}$/i.test(CONTRACT_ADDRESS)) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer) as unknown as Contract;
  }
  return { account, signer, provider: browserProvider as BrowserProvider, contract };
}

// Optional: wrap provider as batch provider when RPC supports it
export async function asBatchProvider(provider: Eip1193Provider) {
  const ethers = await loadEthers();
  // JsonRpcBatchProvider expects URL; when injected provider used, keep BrowserProvider
  // Expose helper if later we decide to use explicit RPC URL
  return new ethers.BrowserProvider(provider);
}

