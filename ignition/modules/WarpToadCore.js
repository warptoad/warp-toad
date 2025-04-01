// @NOTICE will be changed to deploy the full WarpToad 


import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
//import { proxy, PoseidonT3 } from 'poseidon-solidity'

export default buildModule("WarpToadCore", (m) => {
  // TODO use nix method so we reused the same contract
  // https://github.com/chancehudson/poseidon-solidity?tab=readme-ov-file#deploy
  const PoseidonT3Lib = m.library("PoseidonT3");
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
