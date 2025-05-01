// @NOTICE will be changed to deploy the full WarpToad 


import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
//import { proxy, PoseidonT3 } from 'poseidon-solidity'
console.warn("TODO broken gigaBridge should be removed from constructor")
export default buildModule("L1WarpToad", (m) => {
  // TODO use nix method so we reused the same contract
  // https://github.com/chancehudson/poseidon-solidity?tab=readme-ov-file#deploy

  const maxTreeDepth = m.getParameter("maxTreeDepth");
  const gigaBridge = m.getParameter("gigaBridge");
  const name =`wrptdUSDCOIN`
  const symbol = `wrptdUSDC`

  const PoseidonT3Lib = m.library("PoseidonT3");

  const LazyIMTLib = m.library("LazyIMT",{
    libraries: {
      PoseidonT3: PoseidonT3Lib,
    },

  });
  const withdrawVerifier = m.contract("WithdrawVerifier",[],{});
  const USDcoin = m.contract("USDcoin", [], {});
  const nativeToken = USDcoin 

  const L1WarpToad = m.contract("L1WarpToad", [maxTreeDepth,gigaBridge,withdrawVerifier,nativeToken,name,symbol], {
    value: 0n,
    libraries: {
      LazyIMT: LazyIMTLib,
      PoseidonT3: PoseidonT3Lib
    },
  });

  return { L1WarpToad, withdrawVerifier};
});
