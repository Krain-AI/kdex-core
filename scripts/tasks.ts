import { task } from "hardhat/config";
import { promises as fs } from "fs";
import path from "path";

// Task to deploy KDEX Core
task("deploy-kdex", "Deploy KDEX Core contracts")
  .addFlag("verify", "Verify contracts after deployment")
  .addFlag("save", "Save deployment addresses to file")
  .setAction(async (taskArgs, hre) => {
    const deployScript = await import("./deploy");
    
    console.log(`🚀 Deploying KDEX Core to ${hre.network.name}...`);
    
    const result = await deployScript.default();
    
    const deploymentInfo = {
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      timestamp: new Date().toISOString(),
      deployer: result.deployerAddress,
      contracts: {
        UniswapV2Factory: await result.factory.getAddress(),
        ILPManager: await result.ilpManager.getAddress(),
      },
      gasUsed: result.gasUsed.toString(),
    };
    
    // Save deployment info if requested
    if (taskArgs.save) {
      const deploymentsDir = path.join(__dirname, "..", "deployments");
      await fs.mkdir(deploymentsDir, { recursive: true });
      
      const filename = `${hre.network.name}-${Date.now()}.json`;
      const filepath = path.join(deploymentsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(deploymentInfo, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));
      console.log(`📄 Deployment info saved to: ${filepath}`);
    }
    
    // Verify contracts if requested
    if (taskArgs.verify) {
      console.log("\n🔍 Starting contract verification...");
      const verifyScript = await import("./verify");
      
      // Override process.argv for the verification script
      const originalArgv = process.argv;
      process.argv = [
        ...process.argv.slice(0, 2),
        await result.factory.getAddress(),
        await result.ilpManager.getAddress(),
        result.deployerAddress,
      ];
      
      try {
        await verifyScript.default();
      } catch (error) {
        console.warn("⚠️ Verification failed, but deployment was successful");
        console.warn("You can verify manually later using the verify script");
      } finally {
        process.argv = originalArgv;
      }
    }
    
    console.log("\n🎉 Deployment process completed!");
    return deploymentInfo;
  });

// Task to verify existing contracts
task("verify-kdex", "Verify KDEX Core contracts")
  .addParam("factory", "UniswapV2Factory contract address")
  .addParam("ilpmanager", "ILPManager contract address")
  .addParam("deployer", "Deployer address (used as constructor arg)")
  .setAction(async (taskArgs, hre) => {
    const verifyScript = await import("./verify");
    
    // Override process.argv for the verification script
    const originalArgv = process.argv;
    process.argv = [
      ...process.argv.slice(0, 2),
      taskArgs.factory,
      taskArgs.ilpmanager,
      taskArgs.deployer,
    ];
    
    try {
      await verifyScript.default();
    } finally {
      process.argv = originalArgv;
    }
  });

// Task to check deployment status
task("check-deployment", "Check the status of deployed contracts")
  .addParam("factory", "UniswapV2Factory contract address")
  .addParam("ilpmanager", "ILPManager contract address")
  .setAction(async (taskArgs, hre) => {
    const { ethers } = hre;
    
    console.log("🔍 Checking KDEX Core deployment status...");
    console.log("=".repeat(60));
    
    try {
      // Connect to deployed contracts
      const factory = await ethers.getContractAt("UniswapV2Factory", taskArgs.factory);
      const ilpManager = await ethers.getContractAt("ILPManager", taskArgs.ilpmanager);
      
      // Check basic contract info
      console.log("Network:", hre.network.name);
      console.log("Factory Address:", await factory.getAddress());
      console.log("ILPManager Address:", await ilpManager.getAddress());
      
      // Check connections
      const factoryIlpManager = await factory.ilpManagerAddress();
      const ilpManagerFactory = await ilpManager.factory();
      const ilpManagerOwner = await ilpManager.ilpManagerOwner();
      const feeToSetter = await factory.feeToSetter();
      
      console.log("\n📋 Contract Configuration:");
      console.log("Factory -> ILPManager:", factoryIlpManager);
      console.log("ILPManager -> Factory:", ilpManagerFactory);
      console.log("ILPManager Owner:", ilpManagerOwner);
      console.log("Fee To Setter:", feeToSetter);
      
      // Verify connections
      const connectionsValid = 
        factoryIlpManager.toLowerCase() === taskArgs.ilpmanager.toLowerCase() &&
        ilpManagerFactory.toLowerCase() === taskArgs.factory.toLowerCase();
      
      console.log("\n✅ Status:", connectionsValid ? "Deployment Valid" : "⚠️ Configuration Issues");
      
      if (!connectionsValid) {
        console.log("\n❌ Issues found:");
        if (factoryIlpManager.toLowerCase() !== taskArgs.ilpmanager.toLowerCase()) {
          console.log("- Factory ILP Manager address mismatch");
        }
        if (ilpManagerFactory.toLowerCase() !== taskArgs.factory.toLowerCase()) {
          console.log("- ILP Manager factory address mismatch");
        }
      }
      
    } catch (error) {
      console.error("❌ Error checking deployment:", error);
      throw error;
    }
  }); 