/**
 * L1ScrollBridgeAdapter Contract ABI
 * Auto-generated from backend typechain types
 * DO NOT EDIT MANUALLY
 */

export const L1ScrollBridgeAdapterAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l1ScrollMessenger",
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
        "name": "_l2Root",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_l2BlockNumber",
        "type": "uint256"
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
        "internalType": "address",
        "name": "_l2ScrollBridgeAdapter",
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
    "name": "l1ScrollMessenger",
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
    "name": "l2ScrollBridgeAdapter",
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
        "name": "_newGigaRoot",
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
        "internalType": "uint256",
        "name": "_newGigaRoot",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_gasLimit",
        "type": "uint256"
      }
    ],
    "name": "receiveGigaRoot",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
] as const;

export type L1ScrollBridgeAdapterAbi = typeof L1ScrollBridgeAdapterAbi;
