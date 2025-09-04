"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const typechain_types_1 = require("../../typechain-types");
const aztec = import('@aztec/aztec.js');
// /**
//  * assumes you have at least 1n wei of the wrapped token token 
//  * @param signer 
//  * @param warpToadAddress 
//  */
// async function estimateMintGas(signer: ethers.Signer, warpToadAddress: string,amount: bigint) {
//     console.log({warpToadAddress})
//     // cant use top level await because hardhat needs us to not do type:"module" in package.json
//     const {Fr} = await aztec
//     const warpToad: L1WarpToad = L1WarpToad__factory.connect(warpToadAddress, signer) // why .toString() is hardhat dum?
//     const chainId = (await signer.provider?.getNetwork())?.chainId as bigint
//     const secret = Fr.random().toBigInt()
//     const nullifierPreimage = Fr.random().toBigInt()
//     const preCommitment = hashPreCommitment(nullifierPreimage, secret, chainId)
//     const relayer = "0x0000000000000000000000000000000000000001"
//     const recipient = await signer.getAddress()
//     console.log("wrapping")
//     const USDcoinAddress = await warpToad.nativeToken()
//     const USDC: USDcoin = USDcoin__factory.connect(USDcoinAddress.toString(), signer)
//     await (await USDC.approve(warpToadAddress, amount)).wait(1)
//     await (await warpToad.wrap(amount)).wait(1)
//     const commitment = hashCommitment(preCommitment, amount)
//     console.log("burning!!!!!!")
//     await (await warpToad.burn(preCommitment, amount)).wait(1)
//     const priorityFee = 1n // 
//     const feeFactor = 2n //
//     const maxFee = amount // 
//     console.log("proofing!!!!")
//     console.warn("giga root is not correctly set. Instead a fake testing root is set (this will break in actual bridging)")
//     await (await warpToad.storeLocalRootInHistory()).wait(1); // TODO make relayer do this and get a root from history instead
//     await (await warpToad.receiveGigaRoot(ethers.toBeHex(123n))).wait(1); // TODO this is not how it is supposed to work. GigaBridge should do this
//     const proofInputs = await getProofInputs(gigaBridge, warpToad,warpToad,amount,feeFactor,priorityFee,maxFee,relayer,recipient,nullifierPreimage,secret)
//     console.log({proofInputs})
//     const proof = await createProof(proofInputs, os.cpus().length)
//     console.log({proofInputs, proof})
//     //@ts-ignore
//     const gas = await warpToad.mint.estimateGas(
//         ethers.toBigInt(proofInputs.nullifier),
//         ethers.toBigInt(amount),
//         ethers.toBigInt(proofInputs.giga_root),
//         ethers.toBigInt(proofInputs.destination_local_root),
//         ethers.toBigInt(proofInputs.fee_factor), 
//         ethers.toBigInt(proofInputs.priority_fee), 
//         ethers.toBigInt(proofInputs.max_fee), 
//         ethers.getAddress(relayer),
//         ethers.getAddress(recipient),
//         ethers.hexlify(proof.proof)   
//     )
//     return gas
// }
async function getFreeMoney(signer, USDcoinAddress, amount) {
    const USDC = typechain_types_1.USDcoin__factory.connect(USDcoinAddress.toString(), signer);
    console.log(`trying to mint ${ethers_1.ethers.formatUnits(amount, await USDC.decimals())} ${await USDC.symbol()} function of native token`);
    // TODO just rename to mint lmao
    await (await USDC.getFreeShit(amount)).wait(1);
}
async function getBalance(signer, USDcoinAddress) {
    const USDC = typechain_types_1.USDcoin__factory.connect(USDcoinAddress.toString(), signer);
    return await USDC.balanceOf(await signer.getAddress());
}
async function getNativeTokenAddress(signer, warpToadAddress) {
    const warpToad = typechain_types_1.L1WarpToad__factory.connect(warpToadAddress.toString(), signer); // why .toString() is hardhat dum?
    return ethers_1.ethers.getAddress(await warpToad.nativeToken());
}
// async function main() {
//     const parser = new ArgumentParser({
//         description: 'TODO',
//         usage: ``
//     });
//     // parser.add_argument('-n', '--nativeToken', { help: 'contract address of a L1WarpToad instance', required: true, type: 'str' });
//     // parser.add_argument('-w', '--warptoad', { help: 'contract address of a L1WarpToad instance', required: true, type: 'str' });
//     parser.add_argument("-d", "--deployedAddressesJson", {help: 'ex ignition/deployments/chain-31337/deployed_addresses.json'})
//     parser.add_argument('-p', '--privatekey', { help: 'privatekey used to initiated burn', default:"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", required: false, type: 'str' });
//     parser.add_argument('-r', '--rpc', { help: 'url to rpc ex: http:localhost:8545',default:"http:localhost:8545", required: false, type: 'str' });
//     const args = parser.parse_args()
//     const deployedAddresses = JSON.parse(((await fs.readFile(args.deployedAddressesJson)).toString()))
//     console.log({deployedAddresses})
//     // TODO make flag to switch between L1 and L2. Or maybe just get a warptoad since deployedAddressesc wont have both L1 and L2 in the same file
//     const warpToadAddress = deployedAddresses["L1WarpToad#L1WarpToad"] 
//     const provider = new ethers.JsonRpcProvider(args.rpc)
//     const signer = new NonceManager(new ethers.Wallet(args.privatekey, provider))
//     const nativeTokenAddress = await getNativeTokenAddress(signer,warpToadAddress)
//     const amount = 200000000000n // because feeFactor should be at least 2 and fee paid = (baseFee+priorityFe)*feeFactor. 20000000000n assumes (basefee+priorityFee) = 100gwei
//     if (await getBalance(signer, nativeTokenAddress) < amount) {
//         console.warn(`not enough tokens from native token ${nativeTokenAddress}`)
//         await getFreeMoney(signer, nativeTokenAddress, amount)
//     }
//     const gas = await estimateMintGas(signer,warpToadAddress, amount)
//     console.log({gas})
//     process.exit(0)
// }
// if (require.main === module) {
//     main()
// }
