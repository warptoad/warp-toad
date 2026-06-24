/**
 * GigaBridge Contract ABI
 * Auto-generated from backend Hardhat artifacts
 * DO NOT EDIT MANUALLY
 */

export const GigaBridgeAbi = [
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_gigaRootRecipients",
        "type": "address[]"
      },
      {
        "internalType": "uint8",
        "name": "_maxTreeDepth",
        "type": "uint8"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "newGigaRoot",
        "type": "uint256"
      }
    ],
    "name": "ConstructedNewGigaRoot",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "newLocalRoot",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "uint40",
        "name": "localRootIndex",
        "type": "uint40"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "localRootBlockNumber",
        "type": "uint256"
      }
    ],
    "name": "ReceivedNewLocalRoot",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "gigaRoot",
        "type": "uint256"
      }
    ],
    "name": "SentGigaRoot",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "amountOfLocalRoots",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_localRootProvider",
        "type": "address"
      }
    ],
    "name": "getLocalRootProvidersIndex",
    "outputs": [
      {
        "internalType": "uint40",
        "name": "",
        "type": "uint40"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "gigaRoot",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_localRootProvider",
        "type": "address"
      }
    ],
    "name": "isLocalRootProviders",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "localRootBlockNumbers",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxTreeDepth",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "rootTreeData",
    "outputs": [
      {
        "internalType": "uint40",
        "name": "maxIndex",
        "type": "uint40"
      },
      {
        "internalType": "uint40",
        "name": "numberOfLeaves",
        "type": "uint40"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_gigaRootRecipient",
        "type": "address"
      }
    ],
    "name": "sendGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_gigaRootRecipients",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "_amounts",
        "type": "uint256[]"
      }
    ],
    "name": "sendGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address[]",
        "name": "_localRootProvider",
        "type": "address[]"
      }
    ],
    "name": "updateGigaRoot",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export type GigaBridgeAbi = typeof GigaBridgeAbi;
