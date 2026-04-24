import hre from "hardhat";

async function main() {
    const connection = await (hre as any).network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const [signer] = await connection.viem.getWalletClients();

    console.log("Address:", signer.account.address);
    console.log("Current nonce:", await publicClient.getTransactionCount({ address: signer.account.address }));
    console.log("Pending nonce:", await publicClient.getTransactionCount({ address: signer.account.address, blockTag: "pending" }));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
