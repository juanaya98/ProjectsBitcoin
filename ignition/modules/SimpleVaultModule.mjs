import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SimpleVaultModule", (m) => {
  const vault = m.contract("SimpleVault");
  return { vault };
});