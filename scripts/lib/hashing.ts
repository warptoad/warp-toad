//@ts-ignore
import {  Fr} from '@aztec/aztec.js';

//@ts-ignore
import { IMT } from "@zk-kit/imt"
import { poseidon1,poseidon2,poseidon3 } from "poseidon-lite"

import { MerkleTree, PartialMerkleTree, Element } from 'fixed-merkle-tree'
import { ethers } from "ethers";


export function hashPreCommitment(nullifierPreimage: bigint, secret: bigint, chainId: bigint): bigint {
    return poseidon3([nullifierPreimage, secret, chainId])
}

export function hashCommitment(preCommitment:bigint, amount:bigint ): bigint {
    return poseidon2([preCommitment, amount])
}

export function hashNullifier(nullifierPreimage: bigint): bigint {
    return poseidon1([nullifierPreimage])
}
