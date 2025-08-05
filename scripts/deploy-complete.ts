import { ethers } from "hardhat";
import { UniswapV2Factory, ILPManager } from "../typechain-types";

interface DeploymentResult {
  factory: UniswapV2Factory;
  ilpManager: ILPManager;
  deployerAddress: string;
  networkName: string;
  gasUsed: bigint;
}

interface GasConfig {
  gasLimit: number;
  gasPrice: bigint;
}

class DeploymentManager {
  private deployer: any;
  private adminAddress: string;
  private gasConfig: GasConfig;
  private retryCount = 3;
  private retryDelay = 3000; // 3 seconds

  constructor(deployer: any, adminAddress: string) {
    this.deployer = deployer;
    this.adminAddress = adminAddress;
    this.gasConfig = {
      gasLimit: 150000,
      gasPrice: ethers.parseUnits("3", "gwei") // Start with higher gas price
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    increaseGas: boolean = true
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        console.log(`  Attempt ${attempt}/${this.retryCount}: ${operationName}`);
        
        if (increaseGas && attempt > 1) {
          // Increase gas price for retries
          this.gasConfig.gasPrice = this.gasConfig.gasPrice * BigInt(120) / BigInt(100); // 20% increase
          console.log(`  Using gas price: ${ethers.formatUnits(this.gasConfig.gasPrice, "gwei")} gwei`);
        }
        
        const result = await operation();
        
        if (attempt > 1) {
          console.log(`  ✅ Success on attempt ${attempt}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        console.log(`  ⚠️ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < this.retryCount) {
          console.log(`  🔄 Waiting ${this.retryDelay}ms before retry...`);
          await this.delay(this.retryDelay);
        }
      }
    }
    
    throw new Error(`${operationName} failed after ${this.retryCount} attempts. Last error: ${lastError?.message}`);
  }

  async deployContracts(): Promise<DeploymentResult> {
    const networkName = (await ethers.provider.getNetwork()).name;
    let totalGasUsed = 0n;

    console.log("🚀 KDEX Core Complete Deployment Starting...");
    console.log("=".repeat(60));
    console.log("Network:", networkName);
    console.log("Deployer address:", this.deployer.address);
    console.log("Admin address:", this.adminAddress);
    console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(this.deployer.address)), "ETH");
    console.log("=".repeat(60));

    // Step 1: Deploy Factory
    console.log("\n📦 Step 1: Deploying UniswapV2Factory...");
    const factory = await this.executeWithRetry(async () => {
      const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
      const factoryContract = await UniswapV2Factory.deploy(this.deployer.address);
      await factoryContract.waitForDeployment();
      
      const deployTx = factoryContract.deploymentTransaction();
      if (deployTx) {
        const receipt = await deployTx.wait();
        if (receipt) totalGasUsed += receipt.gasUsed;
      }
      
      return factoryContract;
    }, "Factory deployment", false);

    console.log("✅ UniswapV2Factory deployed to:", await factory.getAddress());

    // Step 2: Deploy ILP Manager
    console.log("\n📦 Step 2: Deploying ILPManager...");
    const ilpManager = await this.executeWithRetry(async () => {
      const ILPManager = await ethers.getContractFactory("ILPManager");
      const ilpManagerContract = await ILPManager.deploy(await factory.getAddress());
      await ilpManagerContract.waitForDeployment();
      
      const deployTx = ilpManagerContract.deploymentTransaction();
      if (deployTx) {
        const receipt = await deployTx.wait();
        if (receipt) totalGasUsed += receipt.gasUsed;
      }
      
      return ilpManagerContract;
    }, "ILP Manager deployment", false);

    console.log("✅ ILPManager deployed to:", await ilpManager.getAddress());

    // Step 3: Configure Factory with ILP Manager
    console.log("\n🔧 Step 3: Configuring Factory with ILPManager...");
    await this.executeWithRetry(async () => {
      const tx = await factory.setIlpManagerAddress(await ilpManager.getAddress(), this.gasConfig);
      const receipt = await tx.wait();
      if (receipt) totalGasUsed += receipt.gasUsed;
      return tx;
    }, "Factory ILP Manager configuration");

    console.log("✅ Factory configured with ILP Manager");

    // Step 4: Set up Authorization (if deployer is admin)
    if (this.deployer.address.toLowerCase() === this.adminAddress.toLowerCase()) {
      await this.setupAuthorization(factory, ilpManager);
      totalGasUsed += await this.setupAuthGasUsed || 0n;
    } else {
      console.log("\n⚠️ Deployer is not admin - skipping authorization setup");
      console.log("Admin must run authorization setup separately");
    }

    // Step 5: Verify deployment
    console.log("\n�� Final Verification...");
    await this.verifyDeployment(factory, ilpManager);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 KDEX Core Complete Deployment Finished!");
    console.log("=".repeat(60));
    console.log("UniswapV2Factory:", await factory.getAddress());
    console.log("ILPManager:", await ilpManager.getAddress());
    console.log("Total Gas Used:", totalGasUsed.toString());
    console.log("Network:", networkName);
    console.log("Admin Address:", this.adminAddress);
    console.log("=".repeat(60));

    return {
      factory,
      ilpManager,
      deployerAddress: this.deployer.address,
      networkName,
      gasUsed: totalGasUsed
    };
  }

  private setupAuthGasUsed = 0n;

  private async setupAuthorization(factory: UniswapV2Factory, ilpManager: ILPManager): Promise<void> {
    console.log("\n🔐 Setting up Complete Authorization...");
    
    let currentNonce = await this.deployer.getNonce();
    
    // Step 1: Set ILP Manager Admin
    console.log("Step 1: Setting ILP Manager Admin...");
    await this.executeWithRetry(async () => {
      const tx = await ilpManager.setIlpManagerAdmin(this.adminAddress, {
        ...this.gasConfig,
        nonce: currentNonce
      });
      const receipt = await tx.wait();
      if (receipt) this.setupAuthGasUsed += receipt.gasUsed;
      return tx;
    }, "Set ILP Manager Admin");
    currentNonce++;

    await this.delay(2000);

    // Step 2: Set Treasury Address
    console.log("Step 2: Setting Treasury Address...");
    await this.executeWithRetry(async () => {
      const tx = await ilpManager.setIlpTreasuryAddress(this.adminAddress, {
        ...this.gasConfig,
        nonce: currentNonce
      });
      const receipt = await tx.wait();
      if (receipt) this.setupAuthGasUsed += receipt.gasUsed;
      return tx;
    }, "Set Treasury Address");
    currentNonce++;

    await this.delay(2000);

    // Step 3: Set Upkeep Caller
    console.log("Step 3: Setting Upkeep Caller...");
    await this.executeWithRetry(async () => {
      const tx = await ilpManager.setUpkeepCaller(this.adminAddress, {
        ...this.gasConfig,
        nonce: currentNonce
      });
      const receipt = await tx.wait();
      if (receipt) this.setupAuthGasUsed += receipt.gasUsed;
      return tx;
    }, "Set Upkeep Caller");
    currentNonce++;

    await this.delay(2000);

    // Step 4: Set Threshold Value
    console.log("Step 4: Setting Threshold Value...");
    const targetThreshold = ethers.parseEther("1000");
    await this.executeWithRetry(async () => {
      const tx = await ilpManager.setThresholdValue(targetThreshold, {
        ...this.gasConfig,
        nonce: currentNonce
      });
      const receipt = await tx.wait();
      if (receipt) this.setupAuthGasUsed += receipt.gasUsed;
      return tx;
    }, "Set Threshold Value");
    currentNonce++;

    await this.delay(2000);

    // Step 5: Set Processing Fee Rate
    console.log("Step 5: Setting Processing Fee Rate...");
    const targetFeeRate = 100; // 1%
    await this.executeWithRetry(async () => {
      const tx = await ilpManager.setProcessingFeeRate(targetFeeRate, {
        ...this.gasConfig,
        nonce: currentNonce
      });
      const receipt = await tx.wait();
      if (receipt) this.setupAuthGasUsed += receipt.gasUsed;
      return tx;
    }, "Set Processing Fee Rate");

    console.log("✅ Complete authorization setup finished!");
  }

  private async verifyDeployment(factory: UniswapV2Factory, ilpManager: ILPManager): Promise<void> {
    const factoryIlpManager = await factory.ilpManagerAddress();
    const ilpManagerFactory = await ilpManager.factory();
    const ilpManagerOwner = await ilpManager.ilpManagerOwner();
    const feeToSetter = await factory.feeToSetter();

    console.log("Factory -> ILP Manager:", factoryIlpManager);
    console.log("ILP Manager -> Factory:", ilpManagerFactory);
    console.log("ILP Manager Owner:", ilpManagerOwner);
    console.log("Factory Owner:", feeToSetter);

    // Verify basic connections
    const connectionsValid = 
      factoryIlpManager.toLowerCase() === (await ilpManager.getAddress()).toLowerCase() &&
      ilpManagerFactory.toLowerCase() === (await factory.getAddress()).toLowerCase() &&
      ilpManagerOwner.toLowerCase() === this.deployer.address.toLowerCase() &&
      feeToSetter.toLowerCase() === this.deployer.address.toLowerCase();

    if (!connectionsValid) {
      throw new Error("❌ Deployment verification failed - connections invalid");
    }

    // If deployer is admin, verify authorization
    if (this.deployer.address.toLowerCase() === this.adminAddress.toLowerCase()) {
      const ilpManagerAdmin = await ilpManager.ilpManagerAdmin();
      const treasuryAddress = await ilpManager.ilpTreasuryAddress();
      const upkeepCaller = await ilpManager.upkeepCaller();
      const thresholdValue = await ilpManager.thresholdValue();
      const processingFeeRate = await ilpManager.processingFeeRate();

      console.log("ILP Manager Admin:", ilpManagerAdmin);
      console.log("Treasury Address:", treasuryAddress);
      console.log("Upkeep Caller:", upkeepCaller);
      console.log("Threshold Value:", ethers.formatEther(thresholdValue), "tokens");
      console.log("Processing Fee Rate:", processingFeeRate.toString(), "basis points");

      const authValid = 
        ilpManagerAdmin.toLowerCase() === this.adminAddress.toLowerCase() &&
        treasuryAddress.toLowerCase() === this.adminAddress.toLowerCase() &&
        upkeepCaller.toLowerCase() === this.adminAddress.toLowerCase() &&
        thresholdValue > 0 &&
        processingFeeRate > 0;

      if (!authValid) {
        throw new Error("❌ Authorization verification failed");
      }

      console.log("✅ All authorization verified successfully!");
    }

    console.log("✅ All verifications passed!");
  }
}

async function main(): Promise<DeploymentResult> {
  const [deployer] = await ethers.getSigners();
  const ADMIN_ADDRESS = "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e";

  const deploymentManager = new DeploymentManager(deployer, ADMIN_ADDRESS);
  return await deploymentManager.deployContracts();
}

// Handle both direct execution and module import
if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n✅ Complete deployment finished successfully!");
      console.log("Factory:", result.factory.target);
      console.log("ILP Manager:", result.ilpManager.target);
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error.message);
      process.exit(1);
    });
}

export default main;
