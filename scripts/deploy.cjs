// Deployment script for FarmGame on Monad Testnet
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  const Factory = await ethers.getContractFactory('FarmGame');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log('FarmGame deployed at:', address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


