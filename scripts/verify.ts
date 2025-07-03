import { run } from "hardhat";

interface VerificationConfig {
  factoryAddress: string;
  ilpManagerAddress: string;
  deployerAddress: string;
}

async function verifyContract(
  address: string,
  constructorArguments: any[] = [],
  contractName?: string
) {
  console.log(`\n🔍 Verifying ${contractName || 'contract'} at ${address}...`);
  
  try {
    await run("verify:verify", {
      address,
      constructorArguments,
    });
    console.log(`✅ ${contractName || 'Contract'} verified successfully!`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`ℹ️ ${contractName || 'Contract'} is already verified`);
    } else {
      console.error(`❌ Failed to verify ${contractName || 'contract'}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log("🔍 KDEX V2 Core Contract Verification");
  console.log("=".repeat(50));
  
  // Get contract addresses from command line arguments or prompt user
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log("Usage: npx hardhat run scripts/verify.ts --network baseSepolia <factoryAddress> <ilpManagerAddress> <deployerAddress>");
    console.log("\nExample:");
    console.log("npx hardhat run scripts/verify.ts --network baseSepolia 0x1234... 0x5678... 0x9abc...");
    process.exit(1);
  }
  
  const config: VerificationConfig = {
    factoryAddress: args[0],
    ilpManagerAddress: args[1],
    deployerAddress: args[2],
  };
  
  console.log("Factory Address:", config.factoryAddress);
  console.log("ILPManager Address:", config.ilpManagerAddress);
  console.log("Deployer Address:", config.deployerAddress);
  console.log("=".repeat(50));
  
  try {
    // Verify UniswapV2Factory
    await verifyContract(
      config.factoryAddress,
      [config.deployerAddress], // constructor arg: feeToSetter
      "UniswapV2Factory"
    );
    
    // Wait a bit between verifications
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify ILPManager
    await verifyContract(
      config.ilpManagerAddress,
      [config.factoryAddress], // constructor arg: factory address
      "ILPManager"
    );
    
    console.log("\n" + "=".repeat(50));
    console.log("🎉 All contracts verified successfully!");
    console.log("=".repeat(50));
    console.log(`View on BaseScan:`);
    console.log(`Factory: https://sepolia.basescan.org/address/${config.factoryAddress}`);
    console.log(`ILPManager: https://sepolia.basescan.org/address/${config.ilpManagerAddress}`);
    console.log("=".repeat(50));
    
  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("\n✅ Verification completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

export default main; 