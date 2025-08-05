# KDEX Core Deployment Scripts

This directory contains production-ready scripts for deploying and managing KDEX Core contracts. All scripts have been tested and include proper error handling, retry logic, and gas management.

## 🚀 Main Deployment Scripts

### `deploy-complete.ts`
**Complete deployment with authorization setup**
- Deploys Factory and ILP Manager contracts
- Sets up full authorization if deployer is admin
- Includes retry logic and proper gas handling
- Handles nonce management for sequential transactions

**Usage via tasks:**
```bash
# Deploy with full setup and verification
npx hardhat deploy-kdex --network baseSepolia --verify --save

# Deploy with custom admin
npx hardhat deploy-kdex --network baseSepolia --admin 0xYourAdminAddress --verify --save
```

### `setup-authorization-standalone.ts`
**Authorization setup for existing deployments**
- Sets up admin roles for already deployed contracts
- Auto-detects contract addresses from deployment files
- Robust error handling and transaction sequencing
- Can specify custom threshold and fee rate values

**Usage via tasks:**
```bash
# Setup authorization (auto-detect contracts)
npx hardhat setup-auth --network baseSepolia

# Setup with specific contracts and custom values
npx hardhat setup-auth --network baseSepolia \
  --factory 0xFactoryAddress \
  --ilpmanager 0xILPManagerAddress \
  --threshold 500 \
  --feerate 150
```

### `verify-deployment.ts`
**Comprehensive deployment verification**
- Verifies contract connections and configurations
- Checks authorization setup
- Auto-detects contracts or accepts specific addresses
- Detailed reporting with pass/fail status

**Usage via tasks:**
```bash
# Verify latest deployment
npx hardhat verify-deployment --network baseSepolia --verbose

# Verify specific deployment
npx hardhat verify-deployment --network baseSepolia \
  --factory 0xFactoryAddress \
  --ilpmanager 0xILPManagerAddress
```

## 🛠️ Utility Scripts

### `tasks.ts`
**Hardhat task definitions**
- Defines all deployment and management tasks
- Provides clean CLI interface for all operations
- Includes backward compatibility for legacy tasks

### `verify.ts`
**Block explorer verification**
- Verifies contract source code on BaseScan/Etherscan
- Used automatically by deploy tasks with --verify flag

## 📋 Available Tasks

### Deployment Tasks
```bash
# Complete deployment with authorization
npx hardhat deploy-kdex --network baseSepolia --verify --save

# Setup authorization only
npx hardhat setup-auth --network baseSepolia

# Verify deployment status
npx hardhat verify-deployment --network baseSepolia --verbose
```

### Management Tasks
```bash
# List recent deployments
npx hardhat list-deployments --count 10

# Get contract addresses for app configuration
npx hardhat get-addresses --network baseSepolia

# Get addresses in JSON format
npx hardhat get-addresses --network baseSepolia --json
```

### Verification Tasks
```bash
# Verify contracts on block explorer
npx hardhat verify-contracts --network baseSepolia \
  --factory 0xFactory --ilpmanager 0xILPManager --deployer 0xDeployer

# Legacy compatibility task
npx hardhat check-deployment --network baseSepolia \
  --factory 0xFactory --ilpmanager 0xILPManager
```

## 🔧 Script Features

### Robust Error Handling
- Automatic retry logic for gas pricing issues
- Proper nonce management for sequential transactions  
- Graceful degradation when authorization setup fails
- Clear error messages and troubleshooting guidance

### Gas Management
- Dynamic gas pricing that increases on retries
- Configurable gas limits per operation type
- Handles "replacement transaction underpriced" errors
- Optimized for Base Sepolia network conditions

### Transaction Sequencing
- Proper delays between dependent transactions
- Nonce management to prevent conflicts
- Verification of each step before proceeding
- Rollback capabilities when needed

### Auto-Detection
- Automatically finds latest deployment addresses
- Reads from deployment record files
- Provides fallback options when auto-detection fails
- Clear messaging about what was detected vs provided

## 📁 File Structure

```
scripts/
├── README.md                           # This file
├── deploy-complete.ts                   # Main deployment script
├── setup-authorization-standalone.ts   # Authorization setup
├── verify-deployment.ts                # Deployment verification
├── tasks.ts                           # Hardhat task definitions  
├── verify.ts                          # Block explorer verification
└── deploy-legacy.ts.backup            # Legacy script (backup)
```

## 🎯 Deployment Workflow

### Fresh Deployment
1. Run `npx hardhat deploy-kdex --network baseSepolia --verify --save`
2. Script deploys contracts and sets up authorization automatically
3. Deployment info saved to `deployments/` directory
4. Contracts verified on BaseScan automatically

### Existing Deployment Authorization
1. Run `npx hardhat setup-auth --network baseSepolia` 
2. Script auto-detects contracts from deployment files
3. Sets up complete authorization for specified admin
4. Verifies all settings after completion

### Verification
1. Run `npx hardhat verify-deployment --network baseSepolia --verbose`
2. Script checks all contract connections and configurations
3. Reports detailed status of authorization setup
4. Provides actionable feedback for any issues

## ⚙️ Configuration

### Default Settings
- **Admin Address**: `0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e`
- **Threshold Value**: `1000 tokens`
- **Processing Fee Rate**: `100 basis points (1%)`
- **Gas Price**: `3 gwei` (increases on retries)
- **Gas Limit**: `150,000` per transaction

### Customization
All settings can be overridden via task parameters:
```bash
npx hardhat setup-auth --network baseSepolia \
  --admin 0xCustomAdmin \
  --threshold 2000 \
  --feerate 50
```

## 🔍 Troubleshooting

### Common Issues

**"Replacement transaction underpriced"**
- Scripts automatically retry with higher gas prices
- No manual intervention required

**"Could not auto-detect contract addresses"**
- Provide addresses explicitly using --factory and --ilpmanager flags
- Check that deployment files exist in deployments/ directory

**"Deployer is not the ILP Manager Owner"**
- Ensure you're using the same wallet that deployed the contracts
- Check the deployment records to verify the deployer address

**Authorization setup fails**
- Verify deployer has sufficient ETH for gas
- Ensure deployer is the contract owner
- Check network connectivity and RPC endpoint

### Getting Help
1. Use `--verbose` flag for detailed output
2. Check deployment files in `deployments/` directory  
3. Run `verify-deployment` to diagnose specific issues
4. Review gas prices and network status

---

**🎯 All scripts are production-ready and have been tested with real deployments**
