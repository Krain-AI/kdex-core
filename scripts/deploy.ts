import { ethers } from "hardhat";
import { UniswapV2Factory, ILPManager } from "../typechain-types";

interface DeploymentResult {
  factory: UniswapV2Factory;
  ilpManager: ILPManager;
  deployerAddress: string;
  networkName: string;
  gasUsed: bigint;
}

async function main(): Promise<DeploymentResult> {
  const [deployer] = await ethers.getSigners();
  const networkName = (await ethers.provider.getNetwork()).name;
  
  console.log("🚀 KDEX Core Deployment Starting...");
  console.log("=".repeat(50));
  console.log("Network:", networkName);
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("=".repeat(50));
  
  let totalGasUsed = 0n;
  
  // Step 1: Deploy UniswapV2Factory
  console.log("\n📦 Step 1: Deploying UniswapV2Factory...");
  const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await UniswapV2Factory.deploy(deployer.address); // deployer is initial feeTo setter
  await factory.waitForDeployment();
  
  const factoryDeployTx = factory.deploymentTransaction();
  if (factoryDeployTx) {
    const receipt = await factoryDeployTx.wait();
    if (receipt) totalGasUsed += receipt.gasUsed;
  }
  
  console.log("✅ UniswapV2Factory deployed to:", await factory.getAddress());
  
  // Step 2: Deploy ILPManager
  console.log("\n📦 Step 2: Deploying ILPManager...");
  const ILPManager = await ethers.getContractFactory("ILPManager");
  const ilpManager = await ILPManager.deploy(await factory.getAddress());
  await ilpManager.waitForDeployment();
  
  const ilpManagerDeployTx = ilpManager.deploymentTransaction();
  if (ilpManagerDeployTx) {
    const receipt = await ilpManagerDeployTx.wait();
    if (receipt) totalGasUsed += receipt.gasUsed;
  }
  
  console.log("✅ ILPManager deployed to:", await ilpManager.getAddress());
  
  // Step 3: Configure the factory with ILPManager
  console.log("\n🔧 Step 3: Configuring Factory with ILPManager...");
  const setIlpManagerTx = await factory.setIlpManagerAddress(await ilpManager.getAddress());
  const setIlpManagerReceipt = await setIlpManagerTx.wait();
  if (setIlpManagerReceipt) totalGasUsed += setIlpManagerReceipt.gasUsed;
  
  console.log("✅ Factory configured with ILPManager");
  
  // Step 4: Verify deployment
  console.log("\n🔍 Step 4: Verifying deployment...");
  const factoryIlpManager = await factory.ilpManagerAddress();
  const ilpManagerFactory = await ilpManager.factory();
  const ilpManagerOwner = await ilpManager.ilpManagerOwner();
  
  console.log("Factory ILP Manager:", factoryIlpManager);
  console.log("ILP Manager Factory:", ilpManagerFactory);
  console.log("ILP Manager Owner:", ilpManagerOwner);
  
  // Verify connections
  if (factoryIlpManager === await ilpManager.getAddress() && 
      ilpManagerFactory === await factory.getAddress() &&
      ilpManagerOwner === deployer.address) {
    console.log("✅ All connections verified successfully!");
  } else {
    throw new Error("❌ Deployment verification failed!");
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 KDEX Core Deployment Complete!");
  console.log("=".repeat(50));
  console.log("UniswapV2Factory:", await factory.getAddress());
  console.log("ILPManager:", await ilpManager.getAddress());
  console.log("Total Gas Used:", totalGasUsed.toString());
  console.log("Network:", networkName);
  console.log("=".repeat(50));
  
  return {
    factory,
    ilpManager,
    deployerAddress: deployer.address,
    networkName,
    gasUsed: totalGasUsed
  };
}

// Handle both direct execution and module import
if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n✅ Deployment completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:", error);
      process.exit(1);
    });
}

export default main; 