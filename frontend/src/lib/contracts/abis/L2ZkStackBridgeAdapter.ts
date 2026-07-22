/**
 * L2ZkStackBridgeAdapter Contract ABI
 * Auto-generated from backend Hardhat artifacts
 * DO NOT EDIT MANUALLY
 */

export const L2ZkStackBridgeAdapterAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l1ZkStackBridgeAdapter",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_l2WarpToad",
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
        "name": "gigaRoot",
        "type": "uint256"
      }
    ],
    "name": "NewGigaRoot",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "localRoot",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "l2BlockNumber",
        "type": "uint256"
      }
    ],
    "name": "SentLocalRootToL1",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "L1_MESSENGER",
    "outputs": [
      {
        "internalType": "contract IL1Messenger",
        "name": "",
        "type": "address"
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
    "inputs": [],
    "name": "l1ZkStackBridgeAdapter",
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
    "name": "l1ZkStackBridgeAdapterAliased",
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
    "name": "l2WarpToad",
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
        "name": "_gigaRoot",
        "type": "uint256"
      }
    ],
    "name": "receiveGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
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
    "inputs": [],
    "name": "sentLocalRootToL1",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export type L2ZkStackBridgeAdapterAbi = typeof L2ZkStackBridgeAdapterAbi;
