import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract, Wallet } from 'ethers';
import { MaxUint256 } from 'ethers';
import { keccak256, toUtf8Bytes, AbiCoder } from 'ethers';
import { ecsign } from 'ethereumjs-util';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

import { expandTo18Decimals, getApprovalDigest } from './shared/utilities';
import { ERC20 } from '../typechain-types/test/ERC20';

const TOTAL_SUPPLY = expandTo18Decimals(10000);
const TEST_AMOUNT = expandTo18Decimals(10);

describe('UniswapV2ERC20', () => {
  async function fixture() {
    const [wallet, other] = await ethers.getSigners();
    const tokenFactory = await ethers.getContractFactory('ERC20');
    const token = (await tokenFactory.deploy(TOTAL_SUPPLY)) as ERC20;
    return { token, wallet, other };
  }

  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    const { token, wallet } = await loadFixture(fixture);
    const name = await token.name();
    const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
    expect(name).to.eq('Uniswap V2');
    expect(await token.symbol()).to.eq('UNI-V2');
    expect(await token.decimals()).to.eq(18);
    expect(await token.totalSupply()).to.eq(TOTAL_SUPPLY);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY);
    expect(await token.DOMAIN_SEPARATOR()).to.eq(
      keccak256(
        AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            keccak256(
              toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
            ),
            ethers.keccak256(ethers.toUtf8Bytes(name)),
            keccak256(toUtf8Bytes('1')),
            chainId,
            await token.getAddress(),
          ]
        )
      )
    );
    expect(await token.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'))
    );
  });

  it('approve', async () => {
    const { token, wallet, other } = await loadFixture(fixture);
    await expect(token.approve(other.address, TEST_AMOUNT))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
  });

  it('transfer', async () => {
    const { token, wallet, other } = await loadFixture(fixture);
    await expect(token.transfer(other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT);
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('transfer:fail', async () => {
    const { token, wallet, other } = await loadFixture(fixture);
    await expect(token.transfer(other.address, TOTAL_SUPPLY + BigInt(1))).to.be.reverted; // ds-math-sub-underflow
    await expect(token.connect(other).transfer(wallet.address, 1)).to.be.reverted; // ds-math-sub-underflow
  });

  it('transferFrom', async () => {
    const { token, wallet, other } = await loadFixture(fixture);
    await token.approve(other.address, TEST_AMOUNT);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(0);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT);
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('transferFrom:max', async () => {
    const { token, wallet, other } = await loadFixture(fixture);
    await token.approve(other.address, MaxUint256);
    await expect(token.connect(other).transferFrom(wallet.address, other.address, TEST_AMOUNT))
      .to.emit(token, 'Transfer')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(MaxUint256);
    expect(await token.balanceOf(wallet.address)).to.eq(TOTAL_SUPPLY - TEST_AMOUNT);
    expect(await token.balanceOf(other.address)).to.eq(TEST_AMOUNT);
  });

  it('permit', async () => {
    const { token, other } = await loadFixture(fixture);
    const wallet = new Wallet(ethers.hexlify(ethers.randomBytes(32))).connect(ethers.provider);
    const nonce = await token.nonces(wallet.address);
    const deadline = MaxUint256;
    const digest = await getApprovalDigest(
      token as any,
      { owner: wallet.address, spender: other.address, value: TEST_AMOUNT },
      nonce,
      deadline
    );

    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallet.privateKey.slice(2), 'hex'));

    await expect(token.permit(wallet.address, other.address, TEST_AMOUNT, deadline, v, r, s))
      .to.emit(token, 'Approval')
      .withArgs(wallet.address, other.address, TEST_AMOUNT);
    expect(await token.allowance(wallet.address, other.address)).to.eq(TEST_AMOUNT);
    expect(await token.nonces(wallet.address)).to.eq(BigInt(1));
  });
});
