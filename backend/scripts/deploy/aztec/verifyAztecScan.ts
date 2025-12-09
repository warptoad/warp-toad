import { WarpToadCoreContract as AztecWarpToad, WarpToadCoreContractArtifact } from "contracts/aztec/WarpToadCore/src/artifacts/WarpToadCore";

import testnetDeployments from "../aztec/aztecDeployments/11155111/deployed_addresses.json"
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { getAztecTestAccountNoEnv, initPXE } from "../utils/aztecUtilsNoEnv";
import { createPXE, getPXEConfig } from "@aztec/pxe/server";
import { TestWallet } from "@aztec/test-wallet/server";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { ContractBase } from "@aztec/aztec.js/contracts";
import { Fr } from "@aztec/foundation/fields";
import { aztecDeployments, getAztecWarptoadInstance, getL2AztecAdapterInstance } from "scripts/dev_op/deployment";
import { L2AztecBridgeAdapterContract, L2AztecBridgeAdapterContractArtifact } from "contracts/aztec/L2AztecBridgeAdapter/src/artifacts/L2AztecBridgeAdapter";
import { toBeHex } from "ethers";

const apiUrl = "https://api.devnet.aztecscan.xyz/v1"
const apiKey = "temporary-api-key"
const aztecNodeUrl = "https://devnet.aztec-labs.com"


async function verifyAztecScan(address: AztecAddress, salt: bigint, deployer: AztecAddress, constructorArgs: string[], artifact: ContractArtifact) {
    //idk why
    const publicKeyString = "0x117c12386e075ffacbda87aab144e3a5e54ea81a0acac393648503fdc40afb692feed50d678b9d4dc459c2e0144ce6765aaa0cd5d21618e41abe5450300edd6b0c6f602b23b9ab6c688446a53f74e7d75ce1c9d4828c82edcefdc1fb0422d4732f332e2ea2e57adbf290297f43ebaeb4f50ec2bf39b3424a0172bdec0b508434278cbb3b8810477d23aa7dc1d6266ddc222cb03e1526d34e071e2eac11339d630e333065c42d7321db5903c680fdcfbc784c5a6248336d24a1c3ae9bb97dbe660a3cf114852ba27eabf15d7069025ba0d4029b4cc7e5463090eb2a44615a03c805d3a58bead62678d234e9ffb9f2ae76b4c2491624d43d7702fb38c09e0f8138"
    const res = await fetch(`https://api.devnet.aztecscan.xyz/v1/${apiKey}/l2/contract-instances/${address.toString()}`, {
        method: 'POST',
        headers: {
            'accept': '*/*',
            'Content-Type': 'application/json'
        },
        // body: '{\n  "deployerMetadata": {\n    "contractIdentifier": "string",\n    "details": "string",\n    "creatorName": "string",\n    "creatorContact": "string",\n    "appUrl": "string",\n    "repoUrl": "string",\n    "contractType": null\n  },\n  "verifiedDeploymentArguments": {\n    "salt": "0xdd8F1f41dDf3E5b0xdd8F1f41dDf3E5b0xdd8F1f41dDf3E5b0xdd8F1f41dDf3E",\n    "deployer": "0xE3eD29A1071EbCa1feA03BEbF09Edfdd3b5AC6B26F61b5DE5fb37bbDF27FEDCe",\n    "publicKeysString": "string",\n    "constructorArgs": [\n      "string"\n    ],\n    "stringifiedArtifactJson": "string"\n  }\n}',
        body: JSON.stringify({
            'deployerMetadata': {
                'contractIdentifier': 'TODO',
                'details': 'TODO',
                'creatorName': 'TODO',
                'creatorContact': 'TODO',
                'appUrl': 'TODO',
                'repoUrl': 'TODO',
                'contractType': null
            },
            'verifiedDeploymentArguments': {
                'salt': toBeHex(salt),
                'deployer': deployer.toString(),
                'publicKeysString': publicKeyString,
                'constructorArgs': constructorArgs,
                'stringifiedArtifactJson': JSON.stringify(artifact)
            }
        })
    });
    console.log(res)
    const resJson = await res.json()
    console.log(resJson)
    return resJson

}

async function l2Adapter() {
    const aztecNode = createAztecNodeClient(aztecNodeUrl);
    const wallet = await getAztecTestAccountNoEnv(11155111n, aztecNodeUrl)//await TestWallet.create(aztecNode,)
    const L2AdapterInstance = await getL2AztecAdapterInstance(11155111)
    await wallet.registerContract({ instance: L2AdapterInstance, artifact: L2AztecBridgeAdapterContractArtifact })
    const L2AdapterContract = await L2AztecBridgeAdapterContract.at(AztecAddress.fromString(testnetDeployments.L2AztecBridgeAdapter.address), wallet)
    console.log({ wallet: (await wallet.getAccounts())[0].item, deployer: aztecDeployments[11155111]["L2AztecBridgeAdapter"].deployer })
    //await verifyAztecScanContractClassArtifactWithContractObj(L2AdapterContract)
    await verifyAztecScan(
        L2AdapterContract.address,
        BigInt(testnetDeployments.L2AztecBridgeAdapter.contractAddressSalt),
        AztecAddress.fromString(testnetDeployments.L2AztecBridgeAdapter.deployer),
        testnetDeployments.L2AztecBridgeAdapter.constructorArgs,
        L2AztecBridgeAdapterContractArtifact
    )
}
l2Adapter()
//warpToad()

// async function warpToad() {
//     const aztecNode = createAztecNodeClient(aztecNodeUrl);
//     //const pxeConfig = getPXEConfig();
//     //const PXE =await createPXE(aztecNode,pxeConfig)
//     const wallet = await TestWallet.create(aztecNode,)
//     const warptoadInstance = await getAztecWarptoadInstance(11155111)
//     //await PXE.registerContract({instance:warptoadInstance, artifact:WarpToadCoreContractArtifact})
//     await wallet.registerContract({instance:warptoadInstance, artifact:WarpToadCoreContractArtifact})
//     const warpToadContract = await AztecWarpToad.at(AztecAddress.fromString(testnetDeployments.AztecWarpToad.address), wallet)
//     await verifyAztecScanContractClassArtifactWithContractObj(warpToadContract)

// }


// async function verifyAztecScanContractClassArtifactWithContractObj(contractObj: ContractBase) {
//     const classId = contractObj.instance.currentContractClassId
//     const version = contractObj.instance.version
//     await verifyAztecScanContractClassArtifact(classId, version, contractObj.artifact)
// }

// async function verifyAztecScanContractClassArtifact(classId: Fr, version: number, artifact: ContractArtifact) {
//     const res = await fetch(`${apiUrl}/${apiKey}/l2/contract-classes/${classId.toString()}/versions/${version.toString()}`, {
//         method: 'POST',
//         headers: {
//             'accept': 'application/json',
//             'Content-Type': 'application/json'
//         },
//         // body: '{\n  "stringifiedArtifactJson": "string"\n}',
//         body: JSON.stringify({
//             'stringifiedArtifactJson': JSON.stringify(artifact)
//         })
//     });
//     console.log(res)
//     const resJson = await res.json()
//     console.log(resJson)
//     return resJson
// }