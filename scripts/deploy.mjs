import { ethers } from "hardhat";

async function main() {
  const F = await ethers.getContractFactory("SimpleVault");
  const vault = await F.deploy();
  await vault.waitForDeployment();
  console.log("SimpleVault deployed to:", await vault.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});