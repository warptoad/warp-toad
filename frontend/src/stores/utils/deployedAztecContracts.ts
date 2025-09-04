
//@ts-ignore
import contractsJsonSandbox from "../../../../backend/scripts/deploy/aztecDeployments/31337/deployed_addresses.json"  with { type: 'json' }; // adjust path as needed
//@ts-ignore
import contractsJsonTestnet from "../../../../backend/scripts/deploy/aztecDeployments/11155111//deployed_addresses.json"  with { type: 'json' }; 


const contractsJson = import.meta.env.VITE_SANDBOX=== 'true'?contractsJsonSandbox:contractsJsonTestnet;

type DeployedAztecContracts = {
    AztecWarpToad: string;
    L2AztecRootBridgeAdapter: string;
};

export const deployedAztecContracts: DeployedAztecContracts = {
    AztecWarpToad: contractsJson.AztecWarpToad,
    L2AztecRootBridgeAdapter: contractsJson.L2AztecBridgeAdapter
};

