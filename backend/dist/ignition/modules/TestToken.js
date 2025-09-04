//@ts-ignore
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
export default buildModule("TestToken", (m) => {
    const USDcoin = m.contract("USDcoin", [], {});
    return { USDcoin };
});
