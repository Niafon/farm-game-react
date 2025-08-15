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
  if (process.env.VITE_CONTRACT_ADDRESS_PLACEHOLDER_FILE) {
    const fs = require('fs');
    try {
      fs.writeFileSync(process.env.VITE_CONTRACT_ADDRESS_PLACEHOLDER_FILE, address, 'utf8');
      console.log('Wrote deployed address to', process.env.VITE_CONTRACT_ADDRESS_PLACEHOLDER_FILE);
    } catch {}
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


