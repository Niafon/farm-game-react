import { parseAbi } from 'viem'

// Keep raw ABI strings for compatibility where needed
export const CONTRACT_ABI = [
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
  'function buyWell()',
  'function buyFertilizer()',
  'function getFullState(address player) view returns (string)',
  'function pause()',
  'function unpause()',
  'function paused() view returns (bool)',
  'event StateDelta(address indexed player)'
];

// Parsed ABI used by viem/wagmi calls
export const FARM_ABI = parseAbi(CONTRACT_ABI);

export default CONTRACT_ABI;

