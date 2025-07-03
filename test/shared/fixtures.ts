import { ethers } from 'hardhat';

import { expandTo18Decimals } from './utilities';
import { UniswapV2Factory } from '../../typechain-types';
import { UniswapV2Pair } from '../../typechain-types';
import { ERC20 } from '../../typechain-types';

interface FactoryFixture {
  factory: UniswapV2Factory;
}

export async function factoryFixture(): Promise<FactoryFixture> {
  const [wallet] = await ethers.getSigners();
  const factoryFactory = await ethers.getContractFactory('UniswapV2Factory');
  const factory = (await factoryFactory.deploy(wallet.address)) as UniswapV2Factory;
  return { factory };
}

interface PairFixture extends FactoryFixture {
  token0: ERC20;
  token1: ERC20;
  pair: UniswapV2Pair;
}

export async function pairFixture(): Promise<PairFixture> {
  const { factory } = await factoryFixture();
  const tokenAFactory = await ethers.getContractFactory('ERC20');
  const tokenA = (await tokenAFactory.deploy(expandTo18Decimals(100000))) as ERC20;
  const tokenB = (await tokenAFactory.deploy(expandTo18Decimals(100000))) as ERC20;

  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

  await factory.createPair(tokenAAddress, tokenBAddress);
  const pairAddress = await factory.getPair(tokenAAddress, tokenBAddress);
  const pair = (await ethers.getContractAt('UniswapV2Pair', pairAddress)) as UniswapV2Pair;

  const token0Address = await pair.token0();
  const token0 = tokenAAddress === token0Address ? tokenA : tokenB;
  const token1 = tokenAAddress === token0Address ? tokenB : tokenA;

  return { factory, token0, token1, pair };
}
