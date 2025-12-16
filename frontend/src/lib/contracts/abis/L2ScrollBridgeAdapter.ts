/**
 * L2ScrollBridgeAdapter Contract ABI
 * Auto-generated from backend typechain types
 * DO NOT EDIT MANUALLY
 */

export const L2ScrollBridgeAdapterAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_l2ScrollMessenger",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_l1ScrollBridgeAdapter",
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
      }
    ],
    "name": "SentLocalRootToL1",
    "type": "event"
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
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_gasLimit",
        "type": "uint256"
      }
    ],
    "name": "sentLocalRootToL1",
    "outputs": [],
    "stateMutability": "nonpayable",
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

export type L2ScrollBridgeAdapterAbi = typeof L2ScrollBridgeAdapterAbi;
