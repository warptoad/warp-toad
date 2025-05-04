// @NOTICE will be changed to deploy the full WarpToad 

//@ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { EVM_TREE_DEPTH } from "../../scripts/lib/constants";

export default buildModule("L1WarpToadModule", (m: any) => {
  console.warn(" TODO poseidon should use nix method so we reused the same contract")
  // TODO use nix method so we reused the same contract
  // https://github.com/chancehudson/poseidon-solidity?tab=readme-ov-file#deploy

  const nativeToken = m.getParameter("nativeToken");
  const name = m.getParameter("name");
  const symbol = m.getParameter("symbol");
  const PoseidonT3LibAddress =  m.getParameter("PoseidonT3LibAddress");
  const PoseidonT3Lib = m.contractAt("PoseidonT3",PoseidonT3LibAddress)
  const LazyIMTLib = m.library("LazyIMT", {
    value: 0n,
    libraries: {
      PoseidonT3: PoseidonT3Lib,
    },
  });

  const withdrawVerifier = m.contract("WithdrawVerifier", [], {
    value: 0n,
    libraries: {
    },
  });

  const L1WarpToad = m.contract("L1WarpToad", [EVM_TREE_DEPTH, withdrawVerifier, nativeToken, name, symbol], {
    value: 0n,
    libraries: {
      LazyIMT: LazyIMTLib,
      PoseidonT3: PoseidonT3Lib
    },
  });

  return { L1WarpToad, withdrawVerifier, PoseidonT3Lib, LazyIMTLib };
});
