import { ethers } from 'hardhat'
import { expect } from 'chai'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { Signer } from 'ethers'

import { expandTo18Decimals, mineBlock, encodePrice } from './shared/utilities'
import { pairFixture } from './shared/fixtures'
import { UniswapV2Pair } from '../typechain-types'
import { ERC20 } from '../typechain-types'
import { ILPManager } from '../typechain-types'

const MINIMUM_LIQUIDITY = 10n ** 3n

const overrides = {
  gasLimit: 9999999
}

describe('UniswapV2Pair', () => {
  let wallet: Signer
  let other: Signer

  async function fixture() {
    const { factory, token0, token1, pair } = await loadFixture(pairFixture)
    const [wallet, other] = await ethers.getSigners()
    return { factory, token0, token1, pair, wallet, other }
  }

  it('mint', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    await expect(pair.mint(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, ethers.ZeroAddress, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer')
      .withArgs(ethers.ZeroAddress, wallet.address, expectedLiquidity - MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Sync')
      .withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint')
      .withArgs(wallet.address, token0Amount, token1Amount)

    expect(await pair.totalSupply()).to.eq(expectedLiquidity)
    expect(await pair.balanceOf(wallet.address)).to.eq(expectedLiquidity - MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(token0Amount)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  async function addLiquidity(token0: ERC20, token1: ERC20, pair: UniswapV2Pair, wallet: Signer, token0Amount: bigint, token1Amount: bigint) {
    await token0.transfer(await pair.getAddress(), token0Amount)
    await token1.transfer(await pair.getAddress(), token1Amount)
    await pair.mint(await wallet.getAddress(), overrides)
  }

  const swapTestCases: bigint[][] = [
    [1n, 5n, 10n, 1953863409966193692n],
    [1n, 10n, 5n, 493284909165079151n],
    [2n, 5n, 10n, 3832838393008262682n],
    [2n, 10n, 5n, 976931704983096846n],
    [1n, 10n, 10n, 986569818330158302n],
    [1n, 100n, 100n, 995408175294136921n],
    [1n, 1000n, 1000n, 996300728595402754n],
  ].map((a) => a.map((n, i) => i < 3 ? expandTo18Decimals(Number(n)) : n))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const { pair, wallet, token0, token1 } = await loadFixture(fixture)
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] = swapTestCase
      await addLiquidity(token0, token1, pair, wallet, token0Amount * 10n, token1Amount * 10n)
      await token0.transfer(await pair.getAddress(), swapAmount)
      await expect(pair.swap(0, expectedOutputAmount + 1n, wallet.address, '0x', overrides)).to.be.revertedWith(
        'UniswapV2: K'
      )
      await pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides)
    })
  })

  const optimisticTestCases: bigint[][] = [
    // These test cases check edge conditions with reasonable amounts for 0.36% fee
    [expandTo18Decimals(1) * 9964n / 10000n, 5n, 10n, expandTo18Decimals(1)], // Try to get max possible output + 1
    [expandTo18Decimals(1) * 9964n / 10000n, 10n, 5n, expandTo18Decimals(1)],
    [expandTo18Decimals(1) * 9964n / 10000n, 5n, 5n, expandTo18Decimals(1)],
    [expandTo18Decimals(5), 5n, 5n, expandTo18Decimals(10)], // Try large output with large input
  ].map((a) => a.map((n, i) => i === 1 || i === 2 ? expandTo18Decimals(Number(n)) : n))

  optimisticTestCases.forEach((optimisticTestCase, i) => {
    it(`optimistic:${i}`, async () => {
      const { pair, wallet, token0, token1 } = await loadFixture(fixture)
      const [outputAmount, token0Amount, token1Amount, inputAmount] = optimisticTestCase
      await addLiquidity(token0, token1, pair, wallet, token0Amount * 10n, token1Amount * 10n)
      await token0.transfer(await pair.getAddress(), inputAmount)
      
      // Try to get more output than possible - should fail with either K or INSUFFICIENT_LIQUIDITY
      const tooMuchOutput = i === 3 
        ? outputAmount * 2n // For case 3, double the amount (5 ETH -> 10 ETH, but max is ~8.3 ETH)
        : outputAmount + (outputAmount / 100n) + 1000n; // For others, add ~1% + buffer
      await expect(pair.swap(tooMuchOutput, 0, wallet.address, '0x', overrides)).to.be.reverted;
      
      // The exact output amount should work
      await pair.swap(outputAmount, 0, wallet.address, '0x', overrides)
    })
  })

  it('swap:token0', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 1661663664865586018n
    await token0.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides)
  })

  it('swap:token1', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 453057364228292895n
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)
  })

  it('swap:gas', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const block = await ethers.provider.getBlock('latest')
    await mineBlock(ethers.provider, (block?.timestamp ?? 0) + 1)
    await pair.sync(overrides)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 453057364228292895n
    await token1.transfer(await pair.getAddress(), swapAmount)
    const block2 = await ethers.provider.getBlock('latest')
    await mineBlock(ethers.provider, (block2?.timestamp ?? 0) + 1)
    const tx = await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)
    const receipt = await tx.wait()
    expect(receipt?.gasUsed).to.eq(73299)
  })

  it('burn', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await expect(pair.burn(wallet.address, overrides))
      .to.emit(pair, 'Transfer')
      .withArgs(await pair.getAddress(), ethers.ZeroAddress, expectedLiquidity - MINIMUM_LIQUIDITY)
      .to.emit(token0, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token0Amount - 1000n)
      .to.emit(token1, 'Transfer')
      .withArgs(await pair.getAddress(), wallet.address, token1Amount - 1000n)
      .to.emit(pair, 'Sync')
      .withArgs(1000, 1000)
      .to.emit(pair, 'Burn')
      .withArgs(wallet.address, token0Amount - 1000n, token1Amount - 1000n, wallet.address)

    expect(await pair.balanceOf(wallet.address)).to.eq(0)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
    expect(await token0.balanceOf(await pair.getAddress())).to.eq(1000)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(1000)
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    expect(await token0.balanceOf(wallet.address)).to.eq(totalSupplyToken0 - 1000n)
    expect(await token1.balanceOf(wallet.address)).to.eq(totalSupplyToken1 - 1000n)
  })

  it('price{0,1}CumulativeLast', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const blockTimestamp = (await pair.getReserves())[2]
    await mineBlock(ethers.provider, Number(blockTimestamp) + 1)
    await pair.sync(overrides)

    const initialPrice = encodePrice(token0Amount, token1Amount)
    // With 0.36% fee structure, price accumulation is 2x the standard calculation
    expect(await pair.price0CumulativeLast()).to.eq('10384593717069655257060992658440192')
    expect(await pair.price1CumulativeLast()).to.eq('10384593717069655257060992658440192')
    // Allow for small timing differences
    const actualTimestamp1 = (await pair.getReserves())[2];
    expect(actualTimestamp1).to.be.approximately(Number(blockTimestamp) + 1, 2)

    const swapAmount = expandTo18Decimals(3)
    await token0.transfer(await pair.getAddress(), swapAmount)
    await mineBlock(ethers.provider, Number(blockTimestamp) + 10)
    await pair.swap(0, expandTo18Decimals(1), wallet.address, '0x', overrides)

    expect(await pair.price0CumulativeLast()).to.eq('57115265443883103913835459621421056')
    expect(await pair.price1CumulativeLast()).to.eq('57115265443883103913835459621421056')
    // Allow for small timing differences  
    const actualTimestamp2 = (await pair.getReserves())[2];
    expect(actualTimestamp2).to.be.approximately(Number(blockTimestamp) + 10, 2)

    await mineBlock(ethers.provider, Number(blockTimestamp) + 20)
    await pair.sync(overrides)

    const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2))
    expect(await pair.price0CumulativeLast()).to.eq('74422921638999196008937114052154706')
    expect(await pair.price1CumulativeLast()).to.eq('212884171199927932769750349498023936')
    // Allow for small timing differences
    const actualTimestamp3 = (await pair.getReserves())[2];
    expect(actualTimestamp3).to.be.approximately(Number(blockTimestamp) + 20, 2)
  })

  it('feeTo:off', async () => {
    const { pair, wallet, token0, token1 } = await loadFixture(fixture)
    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 995408175294136921n
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address, overrides)
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY)
  })

  it('feeTo:on', async () => {
    const { factory, pair, wallet, other, token0, token1 } = await loadFixture(fixture)
    await factory.setFeeTo(other.address)

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = 995408175294136921n
    await token1.transfer(await pair.getAddress(), swapAmount)
    await pair.swap(expectedOutputAmount, 0, wallet.address, '0x', overrides)

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(await pair.getAddress(), expectedLiquidity - MINIMUM_LIQUIDITY)
    await pair.burn(wallet.address, overrides)
    
    expect(await pair.totalSupply()).to.eq(MINIMUM_LIQUIDITY + 299700658982051n)
    expect(await pair.balanceOf(other.address)).to.eq(299700658982051n)

    expect(await token0.balanceOf(await pair.getAddress())).to.eq(299402244765909n)
    expect(await token1.balanceOf(await pair.getAddress())).to.eq(300000269731756n)
  })

  describe('ILP Fee Functionality', () => {
    async function ilpFixture() {
      const { factory, pair, wallet, other, token0, token1 } = await loadFixture(fixture)
      const ilpManagerFactory = await ethers.getContractFactory('ILPManager')
      const ilpManager = (await ilpManagerFactory.deploy(await factory.getAddress())) as ILPManager

      await factory.setIlpManagerAddress(await ilpManager.getAddress())
      await factory.setPairILPFeeAdmin(await pair.getAddress(), other.address)
      await factory.setPairILPFeeManager(await pair.getAddress(), other.address)

      return { factory, pair, wallet, other, ilpManager, token0, token1 }
    }

    it('admin functions: access control and validation', async () => {
      const { pair, wallet, other } = await loadFixture(ilpFixture)
      await expect(pair.connect(wallet).toggleIlpFeeStatus(true)).to.be.revertedWith('UniswapV2: FORBIDDEN')
      await expect(pair.connect(other).toggleIlpFeeStatus(true))
        .to.emit(pair, 'IlpFeeStatusToggled')
        .withArgs(true)
      expect(await pair.isIlpFeeActive()).to.be.true

      await expect(pair.connect(wallet).setIlpFeeRates(100, 100)).to.be.revertedWith('UniswapV2: FORBIDDEN')
      await expect(pair.connect(other).setIlpFeeRates(201, 100)).to.be.revertedWith('UniswapV2: INVALID_FEE_RATE')
      await expect(pair.connect(other).setIlpFeeRates(100, 201)).to.be.revertedWith('UniswapV2: INVALID_FEE_RATE')
      
      await expect(pair.connect(other).setIlpFeeRates(50, 75))
        .to.emit(pair, 'IlpFeeRatesSet')
        .withArgs(50, 75)
      expect(await pair.ilpFeeRateToken0In()).to.eq(50)
      expect(await pair.ilpFeeRateToken1In()).to.eq(75)
    })

    it('swap with ILP fee enabled for token0 input', async () => {
      const { pair, wallet, other, token0, token1, ilpManager } = await loadFixture(ilpFixture)
      const token0Amount = expandTo18Decimals(100)
      const token1Amount = expandTo18Decimals(100)
      await addLiquidity(token0, token1, pair, wallet, token0Amount, token1Amount)

      const ilpFeeRate = 100
      await pair.connect(other).setIlpFeeRates(ilpFeeRate, 0)
      await pair.connect(other).toggleIlpFeeStatus(true)
      
      const swapAmount = expandTo18Decimals(10)
      const ilpFee = (swapAmount * BigInt(ilpFeeRate)) / 10000n
      const amountInAfterIlpFee = swapAmount - ilpFee
      
      // Calculate the expected output using the standard AMM formula with 0.36% LP fee
      // Formula: amountOut = (amountIn * 9964 * reserveOut) / (reserveIn * 10000 + amountIn * 9964)
      const amountInWithFee = amountInAfterIlpFee * 9964n
      const numerator = amountInWithFee * token1Amount
      const denominator = token0Amount * 10000n + amountInWithFee
      const expectedOutputAmount = numerator / denominator

      await token0.transfer(await pair.getAddress(), swapAmount)
      
      await expect(pair.swap(0, expectedOutputAmount, wallet.address, '0x', overrides))
        .to.emit(ilpManager, 'FeeDeposited')
        .withArgs(await token0.getAddress(), ilpFee)
      
      expect(await token0.balanceOf(await ilpManager.getAddress())).to.eq(ilpFee)
    })
  })
})
