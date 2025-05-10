
import contractsJson from "../../../../backend/scripts/deploy/aztecDeployments/31337/deployed_addresses.json"; // adjust path as needed


type DeployedAztecContracts = {
    AztecWarpToad: string;
    L2AztecRootBridgeAdapter: string;
};

export const deployedAztecContracts: DeployedAztecContracts = {
    AztecWarpToad: contractsJson.AztecWarpToad,
    L2AztecRootBridgeAdapter: contractsJson.L2AztecRootBridgeAdapter
};

