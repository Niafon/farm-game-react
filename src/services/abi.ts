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
  'function getFullState(address player) view returns (string)',
  'function pause()',
  'function unpause()',
  'function paused() view returns (bool)',
  'event StateDelta(address indexed player)'
];

export default CONTRACT_ABI;

