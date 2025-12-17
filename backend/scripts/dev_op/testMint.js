import * as hre from "hardhat";
import { L1WarpToad__factory } from "../../typechain-types";
async function main() {
    const provider = hre.ethers.provider;
    const chainId = (await provider.getNetwork()).chainId;
    console.log("Chain ID:", chainId.toString());
    // Get deployment addresses
    const deployments = require(`../../ignition/deployments/chain-${chainId}/deployed_addresses.json`);
    const l1WarpToadAddress = deployments["L1InfraModule#L1WarpToad"];
    console.log("L1WarpToad address:", l1WarpToadAddress);
    // Connect to contract
    const [signer] = await hre.ethers.getSigners();
    const l1WarpToad = L1WarpToad__factory.connect(l1WarpToadAddress, signer);
    // Example values from your error message
    const nullifier = "17787629359149069117794068682066796422581540230596344105763565495600116099393";
    const amount = "10000000";
    const gigaRoot = "10255994179150250985562988635840767182742784352075143525552127821537555409105";
    const localRoot = "21176503402547955683148497517243803456100601146086835611314258036530870394484";
    const feeFactor = "0";
    const priorityFee = "1";
    const maxFee = "10000000";
    const relayer = "0x0000000000000000000000000000000000000001";
    const recipient = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    const proof = "0x0e13ca04bf524a4f52f6198ecdbf6e0fb9cb9f47b0fffb42d4267ae651afe84e16245f2ee71e040e47cfa3062d518b783d2aa1aee2320be4abded6bcd25cc16f1450b5f1415e78682325fb0c9326614272b1bd39c3adfc180e7dfa6f0c9c145b2eb3bd7b830e5216962af625b9bdf8becfcd001bac203c1a9d6499bfd1e8d76216010bcf82ea1c053c86adf147572e4da92d6a0360e6de15b2575d65ccc90dbd2a9a0cfb96e2f597e03c52f08db012dfdb8af52ac36220e0838047af74c7ea04053c769767dbff4881db198dc5b578005fe8fd09d1381ea37d9136668b1f3bf911713db1272bebdc0bdd6427ee87eca74f1d22597400a1c49defb5036ec6f4cd008651709c0aa4b752032b42d3f9a386184455c75de0da2088032f4f58cab3410f12a0cd6d9e365ff543261d61432298e8f56972b2684da458ca8d17922fa96f0642fe6079ef7c3a1fd0898919400f0bd8b91294d413398bb880ea72b79ee78402e5e87c10c7539225335a92d641faa194aa5b8667dc4b506cd408625535822a10467a9219bf37063cafe7b663c6697e159b9b1a7e016f8ac4b841d4e519b85b0660044d03207ca2cd59873738a1cd0a99925678f8d5b25b7163846682f0b11a17c60da07d52808dbb96a074239edd5c56cd4ff367daad61601091ed36825134254709c1802841282beac36a46f453ce544fe2ded48c5cfd94cc2cbb606f99852726d5cbc2fc633165884f1e3cda2486a4b06ff7b332cf7888c4efb8055e91f72c012b294a19b3d61b873b843c45781927d30e0d6b317e32d0b6efd29c75acf60934d8284b978417ef900bd2b8ce07b0bc24b868d60697fb926bdd22f6ab75e50cab2c72903c3b3044f7115ae4ec7098993eb69399116a950efa75a98fca91a318a6b14086976b51a9abd2c1bae0d71b070b9258ae58509eece760a8115490bc1362740f76071cda3cd71f1dbc66935681f0f85b051c8d5edad9976556a951aa1c28f8f9399b5442bd5428cf20d4c0066b096994b6c7822e7ad41b5ee85192060fca9d204fbb9b32f01110c715f01a467fee7a1867bd06189329f3fe039f8bab1177a65c77665f5acbc1a6e76b5ff0c3e8ae9ab720a4f8b4bd286a9227bdaea027f1e4a396260732758363f259997cf33b0f8f8aba916e5d78e116e20feb043a15aba11b4aaff60daaa0759c1aa30e4e3b383ce601ade84b60a4c3b6a7778d6211ffa546e4a2fec3fbab94dd14ef96e65f541c503fabb84472eb24f638eccf070a2ffdfa4a2fcf39e45e0463a27aa8244a9dc8a71670e244edbda59eac0bbfe10771403510f439bc1c2a6a5be8dfba9c92dea593125d26d3a51ca0677e739a38066a93260bd1dabe83fd1966963b40578fb1411c5f14c9aa4a28d507b727d76913913fb3f205ae9ca6d499c100180e426a639d6b214da73d82314905e1e85e5a17b2f610ed582d2603fabed67733b21e1c8994dfc7670c46cfed36857481e4261e0a72cdf634fca19153f29a4ec0ce44e3d4141bf05f14deeb8a754d89e52d4628d4c6bc4f0caad32f206ca425a3c09dabd909c46ce25948721e02ccfc302de60c985ee687258f5a0d5b4c82b12c6f30184473c668aeba0b39ad889a217dddf61412a5651b4fcbeda643167edc86c1b137001c5cb2fb345caff61b3b4cb5fb6f08f0e68ecce31f7f681e578f0fa4dcbd59d6ccb9e13bd8d1af467479fb27430226dec648687e02bec784bd57abb627d4faf1d2f7f3fde53dcfeead122444c9b6027e2377a706d24a6c4a44daebc7365bf60c6f017d69d6ac516fd9f4390de6c613a5b1d9fcb072ae88acb9150117daeba6d1623ce21f0d8a5cf725d5845aa087229dc35e1906af6a902c917b328ef37060d70823dfef9a4193012191ba96286027a3958239345c973f6cce9b1eb090d8709bdd48d9f3cbcc044820b8c3366e8c1468578f22e745d46e9add69c6461a8f73d8f0ed8d068118acb4f0165d62506901f1e8d5dd5088ea15b0fd7be0d60d49ecc00ee3260f1cf3897b331a967fd71c1fdfc88f78eb6c29751763447ce758618ddb152138d1295faa236bb2bf9d5dd00d6959d63354af3f1c2d835697774b1c06c23316d1d9c53a86e9aeb6f8bae4830fefe447bc75b614ba8bb1a23e73ac30c6ed8a909c6894afd511b5d95fceaee822c74f9f0246e9848286256ad7a90eb36097cc04cbb9bceee706b1b2f984620e1d54dc398db059c67186b08e4bb525170a26891f86f8b5feb95432fa292bff6805b9224de171abfd76bc8adc256c0e4308bb0937291977f883d64ffc326d6ea40a1aaf02da6b4aae5c098ecf97d0372d5a4693ab316aa94e842dbdfa800a7c1c0626d0ed961fa0770353c46dfeaccaf0911b3c0f26d175091050e3cca454656327f943d23b83e05270d14916e5ee84e8e730b9897ded5097bd71c5e4fa3fe9272216b3024a8a9dd9f19b50734b7e17f97ad477c5048ff6c476cf5e248c1a43dd09c659b175bcdc3218d7799cb07c85f8ea388a3ebb56d829fd7497f26c223714204da8c94b769b0f3fa412980493f568e42949946bb63c2c670b630e5960358a0c7b3e1fd7aa46ea351022b9db5b824dd846610d91e91491fc8eba9649049e9b28d924b4e792996c8f578cf94c39475457edb15af455f756c4ab58b059df01f11186ea5e673a6e05d900d18fd07669254279b1e3fa8b66603043cddb58a0ed5b17052f1a8298c489cfc79380574b0e9acb5d7ebd043bcd9ef9f19e249eae56781c8373d69df71b0dc68e5570de1fb41054414b960dec34ddc39f6e6de4bbbf952201b892b9557191bd55176164f45985dd25186f179c9c1c8d4d3eb72ac928b210641a9e7925a8f4a6e28d8c324428778df764f14107d33c5541a4226b3db24523f598efc2511651d2fd14b702114d7bbf6b34665be407ba33a9c938122c5059003b8d8a84b4609f882862c28e7d75678f9992a949c61e2016ea61d906a1eb941e5cbb138dbafaeb4c0438436c9fbef1072ac0ee37c6b7fd9d158d6f746b0ad0";
    console.log("\n=== Checking values ===");
    console.log("Is gigaRoot valid?", await l1WarpToad.isValidGigaRoot(gigaRoot));
    console.log("Is localRoot valid?", await l1WarpToad.isValidLocalRoot(localRoot));
    console.log("Is nullifier used?", await l1WarpToad.nullifierHistory(nullifier));
    console.log("\n=== Attempting mint ===");
    try {
        // Try to call the function statically first to see the error
        await l1WarpToad.mint.staticCall(nullifier, amount, gigaRoot, localRoot, feeFactor, priorityFee, maxFee, relayer, recipient, proof);
        console.log("✅ Static call succeeded!");
    }
    catch (error) {
        console.log("❌ Static call failed!");
        console.log("Error:", error.message);
        if (error.data) {
            console.log("Error data:", error.data);
        }
        // Try to decode the error
        if (error.message.includes("nullifier already used")) {
            console.log("Reason: Nullifier already used");
        }
        else if (error.message.includes("_gigaRoot unknown")) {
            console.log("Reason: GigaRoot not in history");
        }
        else if (error.message.includes("_localRoot unknown")) {
            console.log("Reason: LocalRoot not in history");
        }
        else if (error.message.includes("invalid proof")) {
            console.log("Reason: Proof verification failed");
        }
        else {
            console.log("Reason: Unknown - possibly proof verification or other contract logic");
        }
    }
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=testMint.js.map