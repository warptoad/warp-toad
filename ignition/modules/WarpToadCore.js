// @NOTICE will be changed to deploy the full WarpToad 


import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
//import { proxy, PoseidonT3 } from 'poseidon-solidity'
const maxTreeDepth = 32;

export default buildModule("WarpToadCore", (m) => {
  const PoseidonT3Lib = m.library("PoseidonT3",proxy.tx);
  const LeanIMTLib = m.library("LeanIMT",{
    libraries: {
      PoseidonT3: PoseidonT3Lib,
    },

  });
  const maxTreeDepth = m.getParameter("maxTreeDepth");

  const WarpToadCore = m.contract("WarpToadCore", [maxTreeDepth], {
    value: 0n,
    libraries: {
      LeanIMT: LeanIMTLib,
    },
  });

  return { WarpToadCore };
});
