// @NOTICE will be changed to deploy the full WarpToad 

//@ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { GIGA_TREE_DEPTH } from "../../scripts/lib/constants";
import { ethers } from "ethers";
import { IgnitionModuleBuilder } from "@nomicfoundation/ignition-core";

export default buildModule("L1InfraModule", (m: any) => {
    const LazyIMTLibAddress = m.getParameter("LazyIMTLibAddress");
    const L1WarpToadAddress = m.getParameter("L1WarpToadAddress");
    const LazyIMTLib = m.contractAt("LazyIMT",LazyIMTLibAddress)
    const L1WarpToad = m.contractAt("L1WarpToad",L1WarpToadAddress)

    const L1AztecBridgeAdapter = m.contract("L1AztecBridgeAdapter", [], {
        value: 0n,
        libraries: {
        },
    });

    const L1Adapters = [L1AztecBridgeAdapter]
    const gigaRootRecipients = [L1WarpToad, ...L1Adapters]
    const gigaBridgeConstructorArg =  [gigaRootRecipients, GIGA_TREE_DEPTH]
    const gigaBridge = m.contract("GigaBridge",gigaBridgeConstructorArg, {
        value: 0n,
        libraries: {
            LazyIMT: LazyIMTLib,
        }
    });

    return {gigaBridge, L1AztecBridgeAdapter};
});
