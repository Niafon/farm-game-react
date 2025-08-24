// Deployment script for FarmGame on Monad Testnet using ERC1967 proxy
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with:', deployer.address);
  const ImplFactory = await ethers.getContractFactory('FarmGame');
  const impl = await ImplFactory.deploy();
  await impl.waitForDeployment();
  const initData = ImplFactory.interface.encodeFunctionData('initialize');
  const ProxyFactory = await ethers.getContractFactory('ERC1967Proxy');
  const proxy = await ProxyFactory.deploy(await impl.getAddress(), initData);
  await proxy.waitForDeployment();
  const address = await proxy.getAddress();
  console.log('FarmGame proxy deployed at:', address);
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


