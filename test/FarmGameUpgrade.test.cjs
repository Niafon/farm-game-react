const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FarmGame upgrade', function () {
  it('upgrades to V2 and preserves state', async () => {
    const [owner] = await ethers.getSigners();
    const ImplV1 = await ethers.getContractFactory('FarmGame');
    const impl1 = await ImplV1.deploy();
    await impl1.waitForDeployment();
    const initData = ImplV1.interface.encodeFunctionData('initialize');
    const Proxy = await ethers.getContractFactory('ERC1967Proxy');
    const proxy = await Proxy.deploy(await impl1.getAddress(), initData);
    await proxy.waitForDeployment();
    const farm = await ethers.getContractAt('FarmGame', await proxy.getAddress());
    await (await farm.plant(0)).wait();
    const ImplV2 = await ethers.getContractFactory('FarmGameV2');
    const impl2 = await ImplV2.deploy();
    await impl2.waitForDeployment();
    await (await farm.upgradeTo(await impl2.getAddress())).wait();
    const upgraded = await ethers.getContractAt('FarmGameV2', await proxy.getAddress());
    expect(await upgraded.version()).to.equal('v2');
    const state = JSON.parse(await upgraded.getFullState(await owner.getAddress()));
    expect(state.beds[0].stage).to.equal('seed');
  });
});
