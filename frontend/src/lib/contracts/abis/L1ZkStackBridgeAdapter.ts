/**
 * L1ZkStackBridgeAdapter Contract ABI
 * Auto-generated from backend Hardhat artifacts
 * DO NOT EDIT MANUALLY
 */

export const L1ZkStackBridgeAdapterAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_bridgehub",
        "type": "address"
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
        "name": "newL2Root",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "l2Block",
        "type": "uint256"
      }
    ],
    "name": "ReceivedNewL2Root",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEFAULT_L2_GAS_LIMIT",
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
    "name": "L2_GAS_PER_PUBDATA_BYTE_LIMIT",
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
    "name": "bridgehub",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getLocalRootAndBlock",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
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
        "internalType": "uint256",
        "name": "_batchNumber",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_index",
        "type": "uint256"
      },
      {
        "internalType": "uint16",
        "name": "_txNumberInBatch",
        "type": "uint16"
      },
      {
        "internalType": "bytes",
        "name": "_message",
        "type": "bytes"
      },
      {
        "internalType": "bytes32[]",
        "name": "_proof",
        "type": "bytes32[]"
      }
    ],
    "name": "getNewRootFromL2",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "gigaBridge",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_l2ChainId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "_l2ZkStackBridgeAdapter",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_gigaRootBridge",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "l2ChainId",
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
    "name": "l2ZkStackBridgeAdapter",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mostRecentL2Root",
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
    "name": "mostRecentL2RootBlockNumber",
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
        "internalType": "uint256",
        "name": "_l2GasLimit",
        "type": "uint256"
      }
    ],
    "name": "pushGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_newGigaRoot",
        "type": "uint256"
      }
    ],
    "name": "receiveGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

export type L1ZkStackBridgeAdapterAbi = typeof L1ZkStackBridgeAdapterAbi;
