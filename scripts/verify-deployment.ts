import { ethers } from "hardhat";

interface VerificationConfig {
  factoryAddress?: string;
  ilpManagerAddress?: string;
  expectedAdmin?: string;
  verbose?: boolean;
}

class DeploymentVerifier {
  private config: VerificationConfig;

  constructor(config: VerificationConfig = {}) {
    this.config = {
      expectedAdmin: "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e",
      verbose: true,
      ...config
    };
  }

  async verifyDeployment(): Promise<boolean> {
    console.log("🔍 KDEX Core Deployment Verification");
    console.log("=".repeat(60));

    try {
      // Get contract addresses
      const { factoryAddress, ilpManagerAddress } = await this.getContractAddresses();
      
      console.log("Factory Address:", factoryAddress);
      console.log("ILP Manager Address:", ilpManagerAddress);
      console.log("Expected Admin:", this.config.expectedAdmin);
      console.log("=".repeat(60));

      // Connect to contracts
      const factory = await ethers.getContractAt("UniswapV2Factory", factoryAddress);
      const ilpManager = await ethers.getContractAt("ILPManager", ilpManagerAddress);

      // Run all verifications
      const results = await Promise.all([
        this.verifyContractConnections(factory, ilpManager, factoryAddress, ilpManagerAddress),
        this.verifyFactoryConfiguration(factory),
        this.verifyILPManagerConfiguration(ilpManager),
        this.verifyAuthorization(factory, ilpManager)
      ]);

      const allPassed = results.every(result => result);

      console.log("\n" + "=".repeat(60));
      if (allPassed) {
        console.log("🎉 ALL VERIFICATIONS PASSED!");
        console.log("✅ Deployment is fully operational");
      } else {
        console.log("⚠️ SOME VERIFICATIONS FAILED");
        console.log("❌ Review the issues above");
      }
      console.log("=".repeat(60));

      return allPassed;

    } catch (error: any) {
      console.error("❌ Verification failed:", error.message);
      return false;
    }
  }

  private async getContractAddresses(): Promise<{factoryAddress: string, ilpManagerAddress: string}> {
    let factoryAddress = this.config.factoryAddress;
    let ilpManagerAddress = this.config.ilpManagerAddress;

    if (!factoryAddress || !ilpManagerAddress) {
      console.log("🔍 Auto-detecting contract addresses from latest deployment...");
      
      try {
        const deployment = await this.findLatestDeployment();
        factoryAddress = factoryAddress || deployment.factory;
        ilpManagerAddress = ilpManagerAddress || deployment.ilpManager;
        console.log("✅ Found addresses in deployment records");
      } catch (error) {
        throw new Error("Could not auto-detect contract addresses. Please provide them explicitly.");
      }
    }

    if (!factoryAddress || !ilpManagerAddress) {
      throw new Error("Missing contract addresses");
    }

    return { factoryAddress, ilpManagerAddress };
  }

  private async findLatestDeployment(): Promise<{factory: string, ilpManager: string}> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    const files = await fs.readdir(deploymentsDir);
    const deploymentFiles = files.filter(f => f.endsWith('.json'));
    
    if (deploymentFiles.length === 0) {
      throw new Error("No deployment files found");
    }
    
    const latestFile = deploymentFiles.sort().reverse()[0];
    const deploymentData = JSON.parse(
      await fs.readFile(path.join(deploymentsDir, latestFile), 'utf8')
    );
    
    return {
      factory: deploymentData.contracts.UniswapV2Factory,
      ilpManager: deploymentData.contracts.ILPManager
    };
  }

  private async verifyContractConnections(
    factory: any, 
    ilpManager: any, 
    factoryAddress: string, 
    ilpManagerAddress: string
  ): Promise<boolean> {
    console.log("\n🔗 Verifying Contract Connections...");
    
    try {
      const factoryIlpManager = await factory.ilpManagerAddress();
      const ilpManagerFactory = await ilpManager.factory();

      const connectionsValid = 
        factoryIlpManager.toLowerCase() === ilpManagerAddress.toLowerCase() &&
        ilpManagerFactory.toLowerCase() === factoryAddress.toLowerCase();

      if (this.config.verbose) {
        console.log("Factory -> ILP Manager:", factoryIlpManager);
        console.log("Expected ILP Manager:", ilpManagerAddress);
        console.log("ILP Manager -> Factory:", ilpManagerFactory);
        console.log("Expected Factory:", factoryAddress);
      }

      if (connectionsValid) {
        console.log("✅ Contract connections verified");
        return true;
      } else {
        console.log("❌ Contract connections invalid");
        return false;
      }
    } catch (error: any) {
      console.log("❌ Error verifying connections:", error.message);
      return false;
    }
  }

  private async verifyFactoryConfiguration(factory: any): Promise<boolean> {
    console.log("\n🏭 Verifying Factory Configuration...");
    
    try {
      const feeToSetter = await factory.feeToSetter();
      const feeTo = await factory.feeTo();
      const allPairsLength = await factory.allPairsLength();

      if (this.config.verbose) {
        console.log("Fee To Setter (Owner):", feeToSetter);
        console.log("Fee To:", feeTo);
        console.log("Total Pairs Created:", allPairsLength.toString());
      }

      const ownerValid = this.config.expectedAdmin ? 
        feeToSetter.toLowerCase() === this.config.expectedAdmin.toLowerCase() : true;

      if (ownerValid) {
        console.log("✅ Factory configuration verified");
        return true;
      } else {
        console.log("❌ Factory owner mismatch");
        return false;
      }
    } catch (error: any) {
      console.log("❌ Error verifying factory:", error.message);
      return false;
    }
  }

  private async verifyILPManagerConfiguration(ilpManager: any): Promise<boolean> {
    console.log("\n🏗️ Verifying ILP Manager Configuration...");
    
    try {
      const ilpManagerOwner = await ilpManager.ilpManagerOwner();
      const ilpManagerAdmin = await ilpManager.ilpManagerAdmin();
      const upkeepCaller = await ilpManager.upkeepCaller();
      const treasuryAddress = await ilpManager.ilpTreasuryAddress();
      const thresholdValue = await ilpManager.thresholdValue();
      const processingFeeRate = await ilpManager.processingFeeRate();

      if (this.config.verbose) {
        console.log("ILP Manager Owner:", ilpManagerOwner);
        console.log("ILP Manager Admin:", ilpManagerAdmin);
        console.log("Upkeep Caller:", upkeepCaller);
        console.log("Treasury Address:", treasuryAddress);
        console.log("Threshold Value:", ethers.formatEther(thresholdValue), "tokens");
        console.log("Processing Fee Rate:", processingFeeRate.toString(), "basis points");
      }

      // Basic checks
      const hasOwner = ilpManagerOwner !== ethers.ZeroAddress;
      const hasThreshold = thresholdValue > 0;
      const hasFeeRate = processingFeeRate >= 0;

      const configValid = hasOwner && hasThreshold && hasFeeRate;

      if (configValid) {
        console.log("✅ ILP Manager configuration verified");
        return true;
      } else {
        console.log("❌ ILP Manager configuration incomplete");
        return false;
      }
    } catch (error: any) {
      console.log("❌ Error verifying ILP Manager:", error.message);
      return false;
    }
  }

  private async verifyAuthorization(factory: any, ilpManager: any): Promise<boolean> {
    console.log("\n🔐 Verifying Authorization Setup...");
    
    if (!this.config.expectedAdmin) {
      console.log("⚠️ No expected admin specified, skipping detailed authorization check");
      return true;
    }

    try {
      const feeToSetter = await factory.feeToSetter();
      const ilpManagerOwner = await ilpManager.ilpManagerOwner();
      const ilpManagerAdmin = await ilpManager.ilpManagerAdmin();
      const upkeepCaller = await ilpManager.upkeepCaller();
      const treasuryAddress = await ilpManager.ilpTreasuryAddress();

      const authChecks = {
        "Factory Owner": feeToSetter.toLowerCase() === this.config.expectedAdmin.toLowerCase(),
        "ILP Manager Owner": ilpManagerOwner.toLowerCase() === this.config.expectedAdmin.toLowerCase(),
        "ILP Manager Admin": ilpManagerAdmin.toLowerCase() === this.config.expectedAdmin.toLowerCase() || ilpManagerAdmin === ethers.ZeroAddress,
        "Upkeep Caller": upkeepCaller.toLowerCase() === this.config.expectedAdmin.toLowerCase() || upkeepCaller === ethers.ZeroAddress,
        "Treasury Address": treasuryAddress.toLowerCase() === this.config.expectedAdmin.toLowerCase() || treasuryAddress === ethers.ZeroAddress
      };

      let allAuthValid = true;
      for (const [role, isValid] of Object.entries(authChecks)) {
        if (isValid) {
          console.log(`✅ ${role}: CORRECT`);
        } else {
          console.log(`❌ ${role}: INCORRECT`);
          allAuthValid = false;
        }
      }

      if (allAuthValid) {
        console.log("✅ Authorization setup verified");
        return true;
      } else {
        console.log("❌ Authorization setup needs attention");
        return false;
      }
    } catch (error: any) {
      console.log("❌ Error verifying authorization:", error.message);
      return false;
    }
  }
}

async function main() {
  const config: VerificationConfig = {
    // Optional: specify contract addresses if known
    // factoryAddress: "0x...",
    // ilpManagerAddress: "0x...",
    expectedAdmin: "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e",
    verbose: true
  };

  const verifier = new DeploymentVerifier(config);
  const success = await verifier.verifyDeployment();
  
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Verification script failed:", error.message);
    process.exit(1);
  });
}

export { DeploymentVerifier };
