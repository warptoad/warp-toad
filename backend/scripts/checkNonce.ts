const hre = require("hardhat");

async function main() {
    const [signer] = await hre.ethers.getSigners();
    console.log("Address:", signer.address);
    console.log("Current nonce:", await hre.ethers.provider.getTransactionCount(signer.address));
    console.log("Pending nonce:", await hre.ethers.provider.getTransactionCount(signer.address, "pending"));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
