import { task } from "hardhat/config";
import { promises as fs } from "fs";
import path from "path";

// Task to deploy KDEX Core with complete setup
task("deploy-kdex", "Deploy KDEX Core contracts with full authorization setup")
  .addFlag("verify", "Verify contracts after deployment")
  .addFlag("save", "Save deployment addresses to file")
  .addOptionalParam("admin", "Admin address for authorization", "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e")
  .setAction(async (taskArgs, hre) => {
    const deployScript = await import("./deploy-complete");
    
    console.log(`🚀 Deploying KDEX Core to ${hre.network.name}...`);
    console.log(`👤 Admin address: ${taskArgs.admin}`);
    
    const result = await deployScript.default();
    
    const deploymentInfo = {
      network: hre.network.name,
      chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
      timestamp: new Date().toISOString(),
      deployer: result.deployerAddress,
      adminAddress: taskArgs.admin,
      contracts: {
        UniswapV2Factory: await result.factory.getAddress(),
        ILPManager: await result.ilpManager.getAddress(),
      },
      gasUsed: result.gasUsed.toString(),
      authorizationSetup: result.deployerAddress.toLowerCase() === taskArgs.admin.toLowerCase()
    };
    
    // Save deployment info if requested
    if (taskArgs.save) {
      const deploymentsDir = path.join(__dirname, "..", "deployments");
      await fs.mkdir(deploymentsDir, { recursive: true });
      
      const filename = `${hre.network.name}-${Date.now()}.json`;
      const filepath = path.join(deploymentsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`📄 Deployment info saved to: ${filepath}`);
    }
    
    // Verify contracts if requested
    if (taskArgs.verify) {
      console.log("\n🔍 Starting contract verification...");
      try {
        await hre.run("verify:verify", {
          address: await result.factory.getAddress(),
          constructorArguments: [result.deployerAddress],
        });
        
        await hre.run("verify:verify", {
          address: await result.ilpManager.getAddress(),
          constructorArguments: [await result.factory.getAddress()],
        });
        
        console.log("✅ Contract verification completed");
      } catch (error: any) {
        console.warn("⚠️ Verification failed:", error.message);
        console.warn("You can verify manually later");
      }
    }
    
    console.log("\n🎉 Deployment process completed!");
    return deploymentInfo;
  });

// Task to set up authorization for existing deployment
task("setup-auth", "Set up authorization for existing deployment")
  .addOptionalParam("admin", "Admin address for authorization", "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e")
  .addOptionalParam("factory", "Factory contract address (auto-detect if not provided)")
  .addOptionalParam("ilpmanager", "ILP Manager contract address (auto-detect if not provided)")
  .addOptionalParam("threshold", "Threshold value in tokens", "1000")
  .addOptionalParam("feerate", "Processing fee rate in basis points", "100")
  .setAction(async (taskArgs, hre) => {
    const { AuthorizationManager } = await import("./setup-authorization-standalone");
    
    const [deployer] = await hre.ethers.getSigners();
    
    const config = {
      adminAddress: taskArgs.admin,
      factoryAddress: taskArgs.factory,
      ilpManagerAddress: taskArgs.ilpmanager,
      thresholdValue: taskArgs.threshold,
      processingFeeRate: parseInt(taskArgs.feerate)
    };

    console.log(`🔐 Setting up authorization on ${hre.network.name}...`);
    
    const authManager = new AuthorizationManager(deployer, config);
    await authManager.setupAuthorization();
    
    console.log("✅ Authorization setup completed!");
  });

// Task to verify deployment
task("verify-deployment", "Verify KDEX Core deployment")
  .addOptionalParam("factory", "Factory contract address (auto-detect if not provided)")
  .addOptionalParam("ilpmanager", "ILP Manager contract address (auto-detect if not provided)")
  .addOptionalParam("admin", "Expected admin address", "0xB98Ba823097E44c09D4Ae7268AE89ED28Dd10e0e")
  .addFlag("detailed", "Show detailed verification output")
  .setAction(async (taskArgs, hre) => {
    const { DeploymentVerifier } = await import("./verify-deployment");
    
    console.log(`🔍 Verifying deployment on ${hre.network.name}...`);
    
    const config = {
      factoryAddress: taskArgs.factory,
      ilpManagerAddress: taskArgs.ilpmanager,
      expectedAdmin: taskArgs.admin,
      verbose: taskArgs.detailed
    };

    const verifier = new DeploymentVerifier(config);
    const success = await verifier.verifyDeployment();
    
    if (!success) {
      throw new Error("Deployment verification failed");
    }
    
    console.log("✅ Deployment verification completed successfully!");
  });

// Legacy task for backward compatibility
task("check-deployment", "Check the status of deployed contracts (legacy)")
  .addParam("factory", "UniswapV2Factory contract address")
  .addParam("ilpmanager", "ILPManager contract address")
  .setAction(async (taskArgs, hre) => {
    console.log("⚠️ This task is deprecated. Use 'verify-deployment' instead.");
    
    await hre.run("verify-deployment", {
      factory: taskArgs.factory,
      ilpmanager: taskArgs.ilpmanager,
      verbose: true
    });
  });

// Task to verify contracts on block explorer
task("verify-contracts", "Verify contracts on block explorer")
  .addParam("factory", "UniswapV2Factory contract address")
  .addParam("ilpmanager", "ILPManager contract address")
  .addParam("deployer", "Deployer address (used as constructor arg)")
  .setAction(async (taskArgs, hre) => {
    console.log(`🔍 Verifying contracts on ${hre.network.name} block explorer...`);
    
    try {
      console.log("Verifying UniswapV2Factory...");
      await hre.run("verify:verify", {
        address: taskArgs.factory,
        constructorArguments: [taskArgs.deployer],
      });
      
      console.log("Verifying ILPManager...");
      await hre.run("verify:verify", {
        address: taskArgs.ilpmanager,
        constructorArguments: [taskArgs.factory],
      });
      
      console.log("✅ All contracts verified successfully!");
    } catch (error: any) {
      console.error("❌ Verification failed:", error.message);
      throw error;
    }
  });

// Task to list recent deployments
task("list-deployments", "List recent deployments")
  .addOptionalParam("count", "Number of deployments to show", "5")
  .setAction(async (taskArgs, hre) => {
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    
    try {
      const files = await fs.readdir(deploymentsDir);
      const deploymentFiles = files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, parseInt(taskArgs.count));
      
      console.log(`📋 Recent deployments (showing ${deploymentFiles.length}):`);
      console.log("=".repeat(60));
      
      for (const file of deploymentFiles) {
        const content = await fs.readFile(path.join(deploymentsDir, file), 'utf8');
        const deployment = JSON.parse(content);
        
        console.log(`📁 ${file}`);
        console.log(`   Network: ${deployment.network}`);
        console.log(`   Timestamp: ${deployment.timestamp}`);
        console.log(`   Factory: ${deployment.contracts.UniswapV2Factory}`);
        console.log(`   ILP Manager: ${deployment.contracts.ILPManager}`);
        console.log(`   Deployer: ${deployment.deployer}`);
        if (deployment.adminAddress) {
          console.log(`   Admin: ${deployment.adminAddress}`);
        }
        console.log(`   Gas Used: ${deployment.gasUsed}`);
        console.log("");
      }
    } catch (error: any) {
      console.log("No deployment files found or error reading them:", error.message);
    }
  });

// Task to get contract addresses for app configuration
task("get-addresses", "Get contract addresses for app configuration")
  .addOptionalParam("factory", "Factory contract address (auto-detect if not provided)")
  .addOptionalParam("ilpmanager", "ILP Manager contract address (auto-detect if not provided)")
  .addFlag("json", "Output in JSON format")
  .setAction(async (taskArgs, hre) => {
    let factoryAddress = taskArgs.factory;
    let ilpManagerAddress = taskArgs.ilpmanager;

    if (!factoryAddress || !ilpManagerAddress) {
      // Try to get from latest deployment
      try {
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        const files = await fs.readdir(deploymentsDir);
        const deploymentFiles = files.filter(f => f.endsWith('.json'));
        
        if (deploymentFiles.length > 0) {
          const latestFile = deploymentFiles.sort().reverse()[0];
          const deployment = JSON.parse(
            await fs.readFile(path.join(deploymentsDir, latestFile), 'utf8')
          );
          
          factoryAddress = factoryAddress || deployment.contracts.UniswapV2Factory;
          ilpManagerAddress = ilpManagerAddress || deployment.contracts.ILPManager;
        }
      } catch (error) {
        // Ignore errors, user will need to provide addresses
      }
    }

    if (!factoryAddress || !ilpManagerAddress) {
      throw new Error("Could not find contract addresses. Please provide them explicitly.");
    }

    const addresses = {
      network: hre.network.name,
      factory: factoryAddress,
      ilpManager: ilpManagerAddress
    };

    if (taskArgs.json) {
      console.log(JSON.stringify(addresses, null, 2));
    } else {
      console.log(`📋 Contract Addresses for ${hre.network.name}:`);
      console.log("=".repeat(40));
      console.log(`Factory: ${factoryAddress}`);
      console.log(`ILP Manager: ${ilpManagerAddress}`);
      console.log("");
      console.log("For kdex-app configuration:");
      console.log(`factory: '${factoryAddress}',`);
      console.log(`ilpManager: '${ilpManagerAddress}',`);
    }
  });
