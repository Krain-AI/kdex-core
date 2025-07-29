# KDEX Core Deployment Guide

This guide covers deploying KDEX Core contracts to Base Sepolia testnet and eventually to Base mainnet.

## Prerequisites

### 1. Environment Setup

1. **Copy the environment template:**
   ```bash
   cp env.example .env
   ```

2. **Fill in your environment variables in `.env`:**
   ```bash
   # Private key (without 0x prefix)
   PRIVATE_KEY=your_private_key_here
   
   # BaseScan API key for verification
   BASESCAN_API_KEY=your_api_key_here
   
   # Optional: Custom RPC URLs
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   BASE_MAINNET_RPC_URL=https://mainnet.base.org
   ```

### 2. Get Required Assets

#### For Base Sepolia:
- **ETH for gas**: Get Base Sepolia ETH from [Base Sepolia Faucet](https://faucet.quicknode.com/base/sepolia)
- **BaseScan API Key**: Register at [BaseScan](https://basescan.org/apis) and create an API key

#### For Base Mainnet:
- **ETH for gas**: Bridge ETH to Base using [Base Bridge](https://bridge.base.org/)
- **BaseScan API Key**: Same as testnet

### 3. Security Best Practices

- ✅ Use a dedicated deployment wallet (not your main wallet)
- ✅ Only fund the deployment wallet with the minimum ETH needed for gas
- ✅ Never commit your `.env` file to version control
- ✅ Store your private key securely (consider using a hardware wallet for mainnet)

## Deployment Options

### Option 1: Quick Deployment with Tasks (Recommended)

```bash
# Deploy to Base Sepolia with verification and save deployment info
npx hardhat deploy-kdex --network baseSepolia --verify --save

# Deploy to Base Mainnet (when ready)
npx hardhat deploy-kdex --network baseMainnet --verify --save
```

### Option 2: Step-by-Step Manual Deployment

#### Step 1: Deploy Contracts
```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

#### Step 2: Verify Contracts (Optional but recommended)
```bash
npx hardhat verify-kdex --network baseSepolia \
  --factory <FACTORY_ADDRESS> \
  --ilpmanager <ILP_MANAGER_ADDRESS> \
  --deployer <YOUR_DEPLOYER_ADDRESS>
```

#### Step 3: Check Deployment Status
```bash
npx hardhat check-deployment --network baseSepolia \
  --factory <FACTORY_ADDRESS> \
  --ilpmanager <ILP_MANAGER_ADDRESS>
```

## Deployment Process Details

### What Gets Deployed

1. **UniswapV2Factory**
   - Core factory contract for creating trading pairs
   - Configured with ILP (Infinite Liquidity Pool) functionality
   - Deployer becomes the initial `feeToSetter`

2. **ILPManager**
   - Manages accumulated ILP fees
   - Connected to the factory for automated fee collection
   - Deployer becomes the initial `ilpManagerOwner`

### Deployment Steps

1. **Contract Compilation**: Contracts are compiled with optimization enabled (999999 runs)
2. **Factory Deployment**: UniswapV2Factory deployed with deployer as feeToSetter
3. **ILPManager Deployment**: ILPManager deployed with factory address
4. **Configuration**: Factory is configured with ILPManager address
5. **Verification**: Both contracts are verified on BaseScan
6. **Validation**: All connections and configurations are validated

### Gas Estimates

- **UniswapV2Factory**: ~2.9M gas (2,895,276 gas for pair creation)
- **ILPManager**: ~800k gas
- **Configuration**: ~50k gas
- **Total**: ~5.3M gas (measured: 5,269,530 gas)
- **Cost**: ~$10-20 at 1 gwei on Base

## After Deployment

### 1. Save Contract Addresses

The deployment script will output contract addresses. Save these for future reference:

```
UniswapV2Factory: 0x...
ILPManager: 0x...
```

### 2. Verify on BaseScan

If automatic verification fails, you can verify manually:
- Go to [BaseScan](https://sepolia.basescan.org/)
- Search for your contract address
- Click "Contract" → "Verify and Publish"
- Use Solidity 0.5.16 with optimization enabled (999999 runs)

### 3. Configure ILP Settings (Optional)

As the ILP Manager owner, you can configure ILP fee rates for specific tokens:

```typescript
// Example: Set 10 basis points (0.1%) ILP fee for a token
await ilpManager.setIlpFeeRate(tokenAddress, 10);
```

### 4. Create Trading Pairs

Use the factory to create trading pairs:

```typescript
// Create a new trading pair
await factory.createPair(tokenA, tokenB);
```

## Mainnet Deployment Checklist

Before deploying to Base mainnet:

- [ ] Thoroughly test on Base Sepolia
- [ ] Audit smart contracts (if not already done)
- [ ] Prepare sufficient ETH for gas fees (5-10 ETH recommended)
- [ ] Use a hardware wallet or secure key management
- [ ] Double-check all environment variables
- [ ] Have a rollback plan ready
- [ ] Prepare announcement/documentation for users

## Troubleshooting

### Common Issues

1. **Insufficient Gas**: Increase gas limit in hardhat.config.ts
2. **Network Connection**: Check RPC URL and network connectivity
3. **Private Key Issues**: Ensure no 0x prefix and correct format
4. **Verification Failures**: Wait a few minutes and retry, or verify manually

### Useful Commands

```bash
# Check account balance
npx hardhat run --network baseSepolia -e 'console.log(await ethers.provider.getBalance("YOUR_ADDRESS"))'

# List available tasks
npx hardhat help

# Check network configuration
npx hardhat run --network baseSepolia -e 'console.log(await ethers.provider.getNetwork())'
```

## Support

If you encounter issues:
1. Check the [Base documentation](https://docs.base.org/)
2. Review the deployment logs for specific error messages
3. Ensure all prerequisites are met
4. Consider testing on a local Hardhat network first

## Next Steps

After successful deployment:
- Set up a frontend/SDK to interact with your DEX
- Configure monitoring and analytics
- Plan your token listing and liquidity provision strategy
- Set up governance mechanisms for fee management 