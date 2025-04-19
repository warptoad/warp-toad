
// import { Noir } from '@noir-lang/noir_js';
import {UltraPlonkBackend, ProofData} from "@aztec/bb.js";

//@ts-ignore
import { InputMap, Noir, InputValue, CompiledCircuit } from "@noir-lang/noir_js";
// import { BackendInstances, Circuits, Noirs } from '../types.js';
import { ethers } from "ethers";
import { ArgumentParser } from 'argparse';
import fs from "fs/promises";
import { MerkleTree } from "fixed-merkle-tree";
import { poseidon2 } from "poseidon-lite";
import os from 'os';

import { lineReplacer, lineReplacement } from "./replaceLine";

const FIELD_LIMIT = 21888242871839275222246405745257275088548364400416034343698204186575808495617n //using poseidon so we work with 254 bits instead of 256

async function getVkEvmMerkleCircuits(circuit: CompiledCircuit, treeDepth: number) {
    const backend = new UltraPlonkBackend(circuit.bytecode,{ threads:  os.cpus().length })
    const noir =new Noir(circuit)

    //@ts-ignore
    const hashFunc = (left,right) => poseidon2([left, right])
    
    const commitment = 0n
    //@ts-ignore
    const tree = new MerkleTree(treeDepth, [commitment],{hashFunction:hashFunc})
    //@ts-ignore
    const emptyMerkleProof = tree.proof(commitment)

    const proofInputs: InputMap = {
        root: ethers.toBeHex(tree.root) as InputValue,     
        commitment:  ethers.toBeHex(commitment) as InputValue,   
        index:  ethers.toBeHex(0n as InputValue),
        merkle_proof: emptyMerkleProof.pathElements.map((v)=> ethers.toBeHex(v))
            
    }
    const proofWitness = await noir.execute(proofInputs)
    const proofData = await backend.generateProof(proofWitness.witness)
    const {proofAsFields,vkAsFields,vkHash} = await backend.generateRecursiveProofArtifacts(proofData,proofData.publicInputs.length);
    // doesnt work
    // const vk = ethers.hexlify(await backend.getVerificationKey())
    // const vkAsFields = vk.slice(2).match(/.{1,34}/g)?.map((f)=>ethers.zeroPadValue("0x"+f,32));
    // console.log({vkAsFields})
    return {vkAsFields, vkHash}
}

async function main() {
    const parser = new ArgumentParser({
        description: 'TODO',
        usage: `TODO`
    });


    parser.add_argument('-c', '--circuitName', { help: 'circuit name', required: true, type: 'str' });
    parser.add_argument('-d', '--treeDepth', { help: 'so noir sucks we need to make a whole ass proof just to get the vk as fields :/', required: true, type: 'int' });
    parser.add_argument('-ct', '--circuitType', { help: 'where to put the json with the vk', required: true, type: 'str' });
    parser.add_argument('-r', '--rootDirCircuit',  { help: 'root dir of the circuit', required: true, type: 'str' })
    parser.add_argument('-j', '--json', { help: 'dumps vk as fields json into target folder', required: false,  action:'store_true'}); 
    parser.add_argument('-cn', '--constants', { help: 'where the constants are stored in the lib.nr',  default:"circuits/constants/src/lib.nr",  action:'store_true'}); 
    const args = parser.parse_args() 
    const circuit = JSON.parse( (await fs.readFile(`${args.rootDirCircuit}/target/${args.circuitName}.json`)).toString())


    let vk
    switch (args.circuitType) {
        case "EVM":
            vk = await getVkEvmMerkleCircuits(circuit, args.treeDepth) 
            break;
    }
     
    
    if (args.json) {
        await fs.writeFile(`${args.rootDirCircuit}/target/vkAsFields.json`, JSON.stringify(vk, null, 2))
    }

    if (args.constants) {
        const replacements: lineReplacement[] = [
            {
                "original"      :`pub global ${args.circuitName.toUpperCase()}_VK: [Field; 114] =` ,
                "replacement"   :`pub global ${args.circuitName.toUpperCase()}_VK: [Field; 114] = [${vk?.vkAsFields.toString()}];`
            },
            {
                "original"      :`pub global ${args.circuitName.toUpperCase()}_VK_HASH: Field =` ,
                "replacement"   :`pub global ${args.circuitName.toUpperCase()}_VK_HASH: Field = ${vk?.vkHash.toString()};`
            }
        ]
        console.log({replacements})
        await lineReplacer(args.constants, replacements)
    }
    process.exit();

}

main()