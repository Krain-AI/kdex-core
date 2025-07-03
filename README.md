# KDEX V2 Core

[![Test Status](https://img.shields.io/badge/tests-43%20passing-brightgreen)](https://github.com/krain/kdex)
[![Solidity](https://img.shields.io/badge/solidity-0.5.16-blue)](https://soliditylang.org/)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue)](LICENSE)

**KDEX V2 Core** is an enhanced fork of Uniswap V2 Core with **Infinite Liquidity Pool (ILP)** functionality. This protocol introduces an innovative fee structure designed to mitigate impermanent loss for liquidity providers while maintaining full compatibility with the Uniswap V2 ecosystem.

## 🚀 Key Features

### Infinite Liquidity Pool (ILP)
- **Dual Fee Structure**: 0.36% LP fees + configurable ILP fees per token
- **Automated Fee Collection**: ILP fees are collected and managed automatically
- **Threshold-Based Distribution**: Accumulated fees are distributed when thresholds are met
- **Per-Token Configuration**: Different ILP fee rates can be set for each token

### Enhanced Architecture
- **UniswapV2Factory**: Extended with ILP functionality and admin controls
- **UniswapV2Pair**: Modified with ILP fee collection and advanced fee calculations
- **ILPManager**: New contract for managing accumulated ILP fees and distributions
- **Full Compatibility**: Maintains interface compatibility with Uniswap V2

### Production-Ready Infrastructure
- **Comprehensive Test Suite**: 43 passing tests covering all functionality
- **Gas Optimized**: Compiled with 999,999 optimizer runs
- **Deployment Ready**: Complete deployment system for Base Sepolia and Mainnet
- **Contract Verification**: Automated BaseScan verification

## 📋 Technical Specifications

For detailed technical information, see [`KDEX V2 Core_ Technical Specifications.md`](KDEX%20V2%20Core_%20Technical%20Specifications.md).

### Fee Structure
- **LP Fee**: 36 basis points (0.36%) to liquidity providers
- **ILP Fee**: Configurable per token (e.g., 10 basis points = 0.1%)
- **Total Fee**: LP Fee + ILP Fee (e.g., 0.46% total with 0.1% ILP fee)

### Contract Addresses
After deployment, contract addresses will be available here and in the deployment records.

## 🛠️ Development Setup

### Prerequisites
- Node.js >= 16
- npm >= 8

### Installation

```bash
# Clone the repository
git clone https://github.com/krain/kdex.git
cd kdex

# Install dependencies
npm install

# Copy environment template (for deployment)
cp env.example .env
```

### Development Commands

```bash
# Compile contracts
npm run compile
# or
npx hardhat compile

# Run test suite (43 tests)
npm test
# or
npx hardhat test

# Generate gas reports
REPORT_GAS=true npm test

# Type generation
npx hardhat typechain
```

## 🚀 Deployment

### Quick Deployment to Base Sepolia

1. **Setup Environment**
   ```bash
   cp env.example .env
   # Edit .env with your private key and BaseScan API key
   ```

2. **Deploy with Verification**
   ```bash
   npx hardhat deploy-kdex --network baseSepolia --verify --save
   ```

3. **Check Deployment**
   ```bash
   npx hardhat check-deployment --network baseSepolia \
     --factory <FACTORY_ADDRESS> --ilpmanager <ILP_MANAGER_ADDRESS>
   ```

For detailed deployment instructions, see [`DEPLOYMENT.md`](DEPLOYMENT.md).

### Available Networks
- **baseSepolia**: Base Sepolia testnet
- **baseMainnet**: Base mainnet
- **hardhat**: Local development network

### Custom Tasks
```bash
# Deploy KDEX V2 Core
npx hardhat deploy-kdex --network <NETWORK> --verify --save

# Verify contracts
npx hardhat verify-kdex --network <NETWORK> \
  --factory <ADDRESS> --ilpmanager <ADDRESS> --deployer <ADDRESS>

# Check deployment status
npx hardhat check-deployment --network <NETWORK> \
  --factory <ADDRESS> --ilpmanager <ADDRESS>
```

## 🧪 Testing

The test suite has been fully modernized and covers all functionality:

```bash
# Run all tests
npm test

# Run specific test files
npx hardhat test test/UniswapV2Factory.spec.ts
npx hardhat test test/UniswapV2Pair.spec.ts
npx hardhat test test/ILPManager.spec.ts

# Test with gas reporting
REPORT_GAS=true npm test
```

### Test Results
- ✅ **43 tests passing** (0 failing)
- ✅ **Full coverage** of ILP functionality  
- ✅ **Gas optimization** verified (~5.3M gas total deployment)
- ✅ **Production ready** with comprehensive testing

## 📚 Contract Documentation

### Core Contracts

#### UniswapV2Factory
- **Purpose**: Creates and manages trading pairs with ILP functionality
- **New Features**: ILP manager integration, admin controls
- **Interface**: Extended IUniswapV2Factory with ILP methods

#### UniswapV2Pair  
- **Purpose**: Handles swaps, liquidity, and fee collection
- **New Features**: ILP fee calculation, dual fee structure
- **Fee Calculation**: Optimized for 0.36% LP + variable ILP fees

#### ILPManager
- **Purpose**: Manages accumulated ILP fees and distributions  
- **Features**: Threshold-based distribution, per-token configuration
- **Access Control**: Owner-based administration

### Interface Compatibility
KDEX V2 Core maintains full interface compatibility with Uniswap V2, allowing existing tools and frontends to work without modification.

## 🔧 Configuration

### ILP Fee Management
```typescript
// Set ILP fee rate (10 basis points = 0.1%)
await ilpManager.setIlpFeeRate(tokenAddress, 10);

// Enable/disable ILP fees for a pair
await pair.setIlpFeesEnabled(true);

// Deposit accumulated fees
await ilpManager.depositFee(tokenAddress, amount);
```

### Factory Administration
```typescript
// Set fee recipient
await factory.setFeeTo(feeRecipient);

// Update ILP manager
await factory.setIlpManagerAddress(newIlpManager);
```

## 🔐 Security

- **Audited Codebase**: Based on battle-tested Uniswap V2 Core
- **Comprehensive Testing**: 43 tests covering all functionality
- **Gas Optimization**: Maximum optimization with 999,999 runs
- **Access Controls**: Proper admin controls for ILP management

## 📝 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

- **Documentation**: [`KDEX V2 Core_ Technical Specifications.md`](KDEX%20V2%20Core_%20Technical%20Specifications.md)
- **Deployment Guide**: [`DEPLOYMENT.md`](DEPLOYMENT.md)
- **Issues**: GitHub Issues
- **Base Documentation**: [docs.base.org](https://docs.base.org/)

## 🎯 Roadmap

- [x] Core ILP functionality implementation
- [x] Comprehensive test suite (43 tests passing)
- [x] Deployment infrastructure for Base
- [x] Contract verification system
- [ ] Frontend SDK integration
- [ ] Advanced analytics dashboard
- [ ] Governance token integration
- [ ] Cross-chain bridge support

---

**Built with ❤️ for the Base ecosystem**
