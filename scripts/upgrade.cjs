// Upgrade script for FarmGame UUPS proxy
const { ethers } = require('hardhat');

async function main() {
  const proxyAddress = process.env.PROXY_ADDRESS;
  if (!proxyAddress) throw new Error('PROXY_ADDRESS env required');
  const ImplFactory = await ethers.getContractFactory('FarmGameV2');
  const impl = await ImplFactory.deploy();
  await impl.waitForDeployment();
  const farm = await ethers.getContractAt('FarmGame', proxyAddress);
  await (await farm.upgradeTo(await impl.getAddress())).wait();
  console.log('FarmGame upgraded at proxy', proxyAddress);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
