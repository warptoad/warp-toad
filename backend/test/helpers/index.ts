export { deployEvmContracts, type EvmDeployment } from "./deploy-evm";
export { deployAztecContracts, createNode, type AztecDeployment } from "./deploy-aztec";
export {
  setupFullEnvironment,
  setupEvmOnlyEnvironment,
  getTestFeeFactor,
  createCommitment,
  type FullDeployment,
} from "./setup";
export {
  AZTEC_NODE_URL,
  EVM_TREE_DEPTH,
  GIGA_TREE_DEPTH,
  GAS_COST_L1,
  DEFAULT_FEE,
  TEST_COMMITMENT_1,
  TEST_COMMITMENT_2,
  INITIAL_BALANCE,
} from "./constants";
