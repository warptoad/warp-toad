import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

console.warn("TODO broken gigaBridge should be removed from constructor");

export default buildModule("L1WarpToadWithTestTokenModule", (m) => {
  const USDcoin = m.contract("USDcoin", [], {});
  return { USDcoin };
});
