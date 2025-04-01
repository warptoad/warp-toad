require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  	solidity: "0.8.28",
	paths: {
		remappings: [
		"@aztec/governance/=node_modules/@aztec/l1-contracts/src/governance/"
		]
	}
};
