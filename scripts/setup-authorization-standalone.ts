import { ethers } from "hardhat";

interface AuthConfig {
  adminAddress: string;
  factoryAddress?: string;
  ilpManagerAddress?: string;
  thresholdValue?: string;
  processingFeeRate?: number;
}

class AuthorizationManager {
  private deployer: any;
  private config: AuthConfig;
  private gasConfig = {
    gasLimit: 150000,
    gasPrice: ethers.parseUnits("3", "gwei")
  };
  private retryCount = 3;
  private retryDelay = 3000;

  constructor(deployer: any, config: AuthConfig) {
    this.deployer = deployer;
    this.config = config;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        console.log(`  Attempt ${attempt}/${this.retryCount}: ${operationName}`);
        
        if (attempt > 1) {
          this.gasConfig.gasPrice = this.gasConfig.gasPrice * BigInt(120) / BigInt(100);
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

  async setupAuthorization(): Promise<void> {
    console.log("🔐 KDEX Core Authorization Setup");
    console.log("=".repeat(50));
    console.log("Deployer address:", this.deployer.address);
    console.log("Admin address:", this.config.adminAddress);
    console.log("Factory:", this.config.factoryAddress || "Auto-detect");
    console.log("ILP Manager:", this.config.ilpManagerAddress || "Auto-detect");
    console.log("=".repeat(50));

    // Get contract addresses if not provided
    let factoryAddress = this.config.factoryAddress;
    let ilpManagerAddress = this.config.ilpManagerAddress;

    if (!factoryAddress || !ilpManagerAddress) {
      console.log("\n🔍 Auto-detecting contract addresses...");
      const deployments = await this.findLatestDeployment();
      factoryAddress = factoryAddress || deployments.factory;
      ilpManagerAddress = ilpManagerAddress || deployments.ilpManager;
      
      console.log("Found Factory:", factoryAddress);
      console.log("Found ILP Manager:", ilpManagerAddress);
    }

    if (!factoryAddress || !ilpManagerAddress) {
      throw new Error("❌ Could not find contract addresses. Please provide them explicitly.");
    }

    // Connect to contracts
    const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
    const ilpManager = await ethers.getContractAt("ILPManager", ilpManagerAddress);

    // Verify deployer permissions
    const ilpManagerOwner = await ilpManager.ilpManagerOwner();
    if (ilpManagerOwner.toLowerCase() !== this.deployer.address.toLowerCase()) {
      throw new Error(`❌ Deployer ${this.deployer.address} is not the ILP Manager Owner ${ilpManagerOwner}`);
    }

    console.log("✅ Deployer verified as ILP Manager Owner");

    // Setup authorization with proper nonce management
    let currentNonce = await this.deployer.getNonce();
    
    // Step 1: Set ILP Manager Admin
    console.log("\n🔐 Step 1: Setting ILP Manager Admin...");
    const currentAdmin = await ilpManager.ilpManagerAdmin();
    
    if (currentAdmin.toLowerCase() !== this.config.adminAddress.toLowerCase()) {
      await this.executeWithRetry(async () => {
        const tx = await ilpManager.setIlpManagerAdmin(this.config.adminAddress, {
          ...this.gasConfig,
          nonce: currentNonce
        });
        await tx.wait();
        return tx;
      }, "Set ILP Manager Admin");
      currentNonce++;
      await this.delay(2000);
      console.log("✅ ILP Manager Admin set");
    } else {
      console.log("✅ ILP Manager Admin already correct");
    }

    // Step 2: Set Treasury Address
    console.log("\n💰 Step 2: Setting Treasury Address...");
    const currentTreasury = await ilpManager.ilpTreasuryAddress();
    
    if (currentTreasury.toLowerCase() !== this.config.adminAddress.toLowerCase()) {
      await this.executeWithRetry(async () => {
        const tx = await ilpManager.setIlpTreasuryAddress(this.config.adminAddress, {
          ...this.gasConfig,
          nonce: currentNonce
        });
        await tx.wait();
        return tx;
      }, "Set Treasury Address");
      currentNonce++;
      await this.delay(2000);
      console.log("✅ Treasury Address set");
    } else {
      console.log("✅ Treasury Address already correct");
    }

    // Step 3: Set Upkeep Caller
    console.log("\n🤖 Step 3: Setting Upkeep Caller...");
    const currentUpkeepCaller = await ilpManager.upkeepCaller();
    
    if (currentUpkeepCaller.toLowerCase() !== this.config.adminAddress.toLowerCase()) {
      await this.executeWithRetry(async () => {
        const tx = await ilpManager.setUpkeepCaller(this.config.adminAddress, {
          ...this.gasConfig,
          nonce: currentNonce
        });
        await tx.wait();
        return tx;
      }, "Set Upkeep Caller");
      currentNonce++;
      await this.delay(2000);
      console.log("✅ Upkeep Caller set");
    } else {
      console.log("✅ Upkeep Caller already correct");
    }

    // Step 4: Set Threshold Value
    console.log("\n⚡ Step 4: Setting Threshold Value...");
    const targetThreshold = ethers.parseEther(this.config.thresholdValue || "1000");
    const currentThreshold = await ilpManager.thresholdValue();
    
    if (currentThreshold !== targetThreshold) {
      await this.executeWithRetry(async () => {
        const tx = await ilpManager.setThresholdValue(targetThreshold, {
          ...this.gasConfig,
          nonce: currentNonce
        });
        await tx.wait();
        return tx;
      }, "Set Threshold Value");
      currentNonce++;
      await this.delay(2000);
      console.log(`✅ Threshold Value set to ${ethers.formatEther(targetThreshold)} tokens`);
    } else {
      console.log("✅ Threshold Value already correct");
    }

    // Step 5: Set Processing Fee Rate
    console.log("\n💸 Step 5: Setting Processing Fee Rate...");
    const targetFeeRate = this.config.processingFeeRate || 100;
    const currentFeeRate = await ilpManager.processingFeeRate();
    
    if (currentFeeRate !== BigInt(targetFeeRate)) {
      await this.executeWithRetry(async () => {
        const tx = await ilpManager.setProcessingFeeRate(targetFeeRate, {
          ...this.gasConfig,
          nonce: currentNonce
        });
        await tx.wait();
        return tx;
      }, "Set Processing Fee Rate");
      console.log(`✅ Processing Fee Rate set to ${targetFeeRate} basis points`);
    } else {
      console.log("✅ Processing Fee Rate already correct");
    }

    // Final verification
    console.log("\n🔍 Final Verification...");
    await this.verifyAuthorization(ilpManager);
    
    console.log("\n🎉 Authorization setup complete!");
  }

  private async findLatestDeployment(): Promise<{factory: string, ilpManager: string}> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    try {
      const deploymentsDir = path.join(__dirname, '..', 'deployments');
      const files = await fs.readdir(deploymentsDir);
      const deploymentFiles = files.filter(f => f.endsWith('.json'));
      
      if (deploymentFiles.length === 0) {
        throw new Error("No deployment files found");
      }
      
      // Get the most recent deployment file
      const latestFile = deploymentFiles.sort().reverse()[0];
      const deploymentData = JSON.parse(
        await fs.readFile(path.join(deploymentsDir, latestFile), 'utf8')
      );
      
      return {
        factory: deploymentData.contracts.UniswapV2Factory,
        ilpManager: deploymentData.contracts.ILPManager
      };
    } catch (error) {
      throw new Error(`Could not find deployment files: ${error.message}`);
    }
  }

  private async verifyAuthorization(ilpManager: any): Promise<void> {
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

    const allCorrect = 
      ilpManagerAdmin.toLowerCase() === this.config.adminAddress.toLowerCase() &&
      treasuryAddress.toLowerCase() === this.config.adminAddress.toLowerCase() &&
      upkeepCaller.toLowerCase() === this.config.adminAddress.toLowerCase() &&
      thresholdValue > 0 &&
      processingFeeRate > 0;

    if (!allCorrect) {
      throw new Error("❌ Authorization verification failed");
    }

    console.log("✅ All authorization settings verified!");
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const config: AuthConfig = {
    adminAddress: "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e",
    // Optional: specify contract addresses if known
    // factoryAddress: "0x...",
    // ilpManagerAddress: "0x...",
    thresholdValue: "1000", // in tokens
    processingFeeRate: 100   // basis points (1%)
  };

  const authManager = new AuthorizationManager(deployer, config);
  await authManager.setupAuthorization();
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n✅ Authorization setup completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Authorization setup failed:", error.message);
      process.exit(1);
    });
}

export { AuthorizationManager };
