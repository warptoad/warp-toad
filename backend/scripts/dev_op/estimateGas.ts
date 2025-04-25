import { ArgumentParser } from 'argparse';
import { ethers } from 'ethers';
import fs from "fs/promises";
import { WarpToadCore, WarpToadCore__factory } from '../../typechain-types';
import { hashCommitment, hashPreCommitment } from '../lib/hashing';
import { Fr } from '@aztec/aztec.js';
import { createProof, getProofInputs } from '../lib/proving';
import os from 'os';

/**
 * assumes you have at least 1n wei of the wrapped token token 
 * @param signer 
 * @param warpToadAddress 
 */
async function estimateMintGas(signer: ethers.Signer, warpToadAddress: ethers.Addressable) {

    const warpToad: WarpToadCore = WarpToadCore__factory.connect(warpToadAddress.toString(), signer) // why .toString() is hardhat retarded?
    const chainId = (await signer.provider?.getNetwork())?.chainId as bigint
    const secret = Fr.random().toBigInt()
    const nullifierPreimage = Fr.random().toBigInt()
    const preCommitment = hashPreCommitment(nullifierPreimage, secret, chainId)
    const amount = 1n
    const relayer = "0x0000000000000000000000000000000000000000"
    const recipient = await signer.getAddress()

    const commitment = hashCommitment(preCommitment, amount)
    await (await warpToad.burn(preCommitment, amount)).wait(1)
    const priorityFee = 1n // 0n will break
    const feeFactor = 0n // 1n will break because assert != 1
    const maxFee = 1n // we're gonna self relay so we don't care (this is extremely low btw)
    const proofInputs = await getProofInputs(warpToad,warpToad,amount,feeFactor,priorityFee,maxFee,relayer,recipient,nullifierPreimage,secret)
    const proof = await createProof(proofInputs, os.cpus().length)
    //@ts-ignore
    const gas = await warpToad.mint.estimateGas(
        proofInputs.nullifier,
        amount,
        proofInputs.amount,
        proofInputs.destination_local_root,
        proofInputs.fee_factor, 
        proofInputs.priority_fee, 
        proofInputs.max_fee, 
        relayer, 
        recipient,
        ethers.hexlify(proof.proof)   
    )

    return gas
}

async function main() {
    const parser = new ArgumentParser({
        description: 'TODO',
        usage: `yarn ts-node scripts_dev_op/replaceLine.ts --file contracts/evm/WithdrawVerifier.sol --remove "contract UltraVerifier is BaseUltraVerifier {" --replace "contract WithdrawVerifier is BaseUltraVerifier {"`
    });
    console.log(parser)

    parser.add_argument('-f', '--file', { help: 'file to read', required: true, type: 'str' });
    parser.add_argument('-r', '--remove', { help: 'specify what line to replace', required: true, type: 'str' });
    parser.add_argument('-p', '--replace', { help: 'specify what to replace it with', required: true, type: 'str' });
    const args = parser.parse_args()

}

if (require.main === module) {
    main()
}
