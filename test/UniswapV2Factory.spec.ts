import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { getCreate2Address } from './shared/utilities';
import { factoryFixture } from './shared/fixtures';
import { UniswapV2Pair } from '../typechain-types/UniswapV2Pair';
import { UniswapV2Factory } from '../typechain-types/UniswapV2Factory';

const TEST_ADDRESSES: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000',
];

describe('UniswapV2Factory', () => {
  async function fixture() {
    const { factory } = await loadFixture(factoryFixture);
    const [wallet, other] = await ethers.getSigners();
    return { factory, wallet, other };
  }

  it('feeTo, feeToSetter, allPairsLength', async () => {
    const { factory, wallet } = await loadFixture(fixture);
    expect(await factory.feeTo()).to.eq(ethers.ZeroAddress);
    expect(await factory.feeToSetter()).to.eq(wallet.address);
    expect(await factory.allPairsLength()).to.eq(0);
  });

  async function createPair(factory: UniswapV2Factory, tokens: [string, string]) {
    const pairFactory = await ethers.getContractFactory('UniswapV2Pair');
    const bytecode = pairFactory.bytecode;
    const create2Address = getCreate2Address(await factory.getAddress(), tokens, bytecode);
    await expect(factory.createPair(...tokens))
      .to.emit(factory, 'PairCreated')
      .withArgs(TEST_ADDRESSES[0], TEST_ADDRESSES[1], create2Address, BigInt(1));

    await expect(factory.createPair(...tokens)).to.be.reverted; // UniswapV2: PAIR_EXISTS
    await expect(factory.createPair(tokens[1], tokens[0])).to.be.reverted; // UniswapV2: PAIR_EXISTS
    expect(await factory.getPair(...tokens)).to.eq(create2Address);
    expect(await factory.getPair(tokens[1], tokens[0])).to.eq(create2Address);
    expect(await factory.allPairs(0)).to.eq(create2Address);
    expect(await factory.allPairsLength()).to.eq(1);

    const pair = (await ethers.getContractAt('UniswapV2Pair', create2Address)) as UniswapV2Pair;
    expect(await pair.factory()).to.eq(await factory.getAddress());
    expect(await pair.token0()).to.eq(TEST_ADDRESSES[0]);
    expect(await pair.token1()).to.eq(TEST_ADDRESSES[1]);
  }

  it('createPair', async () => {
    const { factory } = await loadFixture(fixture);
    await createPair(factory, TEST_ADDRESSES);
  });

  it('createPair:reverse', async () => {
    const { factory } = await loadFixture(fixture);
    await createPair(factory, TEST_ADDRESSES.slice().reverse() as [string, string]);
  });

  it('createPair:gas', async () => {
    const { factory } = await loadFixture(fixture)
    const tx = await factory.createPair(...TEST_ADDRESSES)
    const receipt = await tx.wait()
    expect(receipt?.gasUsed).to.eq(2895276)
  });

  it('setFeeTo', async () => {
    const { factory, wallet, other } = await loadFixture(fixture);
    await expect(factory.connect(other).setFeeTo(other.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
    await factory.setFeeTo(wallet.address);
    expect(await factory.feeTo()).to.eq(wallet.address);
  });

  it('setFeeToSetter', async () => {
    const { factory, wallet, other } = await loadFixture(fixture);
    await expect(factory.connect(other).setFeeToSetter(other.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
    await factory.setFeeToSetter(other.address);
    expect(await factory.feeToSetter()).to.eq(other.address);
    await expect(factory.setFeeToSetter(wallet.address)).to.be.revertedWith('UniswapV2: FORBIDDEN');
  });

  describe('ILP Admin Functions', () => {
    const pairAddress = TEST_ADDRESSES[0]; // Using a test address as a mock pair address
    const adminAddress = TEST_ADDRESSES[1]; // Using a test address as a mock admin

    it('initial ILP values are zero', async () => {
      const { factory } = await loadFixture(fixture);
      expect(await factory.ilpManagerAddress()).to.eq(ethers.ZeroAddress);
      expect(await factory.pairILPFeeAdmins(pairAddress)).to.eq(ethers.ZeroAddress);
      expect(await factory.pairILPFeeManagers(pairAddress)).to.eq(ethers.ZeroAddress);
    });

    it('setIlpManagerAddress', async () => {
      const { factory, other } = await loadFixture(fixture);
      const newManager = other.address;
      await expect(factory.connect(other).setIlpManagerAddress(newManager)).to.be.revertedWith('UniswapV2: FORBIDDEN');
      await factory.setIlpManagerAddress(newManager);
      expect(await factory.ilpManagerAddress()).to.eq(newManager);
    });

    it('setPairILPFeeAdmin', async () => {
      const { factory, other } = await loadFixture(fixture);
      await expect(factory.connect(other).setPairILPFeeAdmin(pairAddress, adminAddress)).to.be.revertedWith(
        'UniswapV2: FORBIDDEN'
      );
      await factory.setPairILPFeeAdmin(pairAddress, adminAddress);
      expect(await factory.pairILPFeeAdmins(pairAddress)).to.eq(adminAddress);
    });

    it('setPairILPFeeManager', async () => {
      const { factory, other } = await loadFixture(fixture);
      const managerAddress = other.address;
      await expect(factory.connect(other).setPairILPFeeManager(pairAddress, managerAddress)).to.be.revertedWith(
        'UniswapV2: FORBIDDEN'
      );
      await factory.setPairILPFeeManager(pairAddress, managerAddress);
      expect(await factory.pairILPFeeManagers(pairAddress)).to.eq(managerAddress);
    });
  });
});
