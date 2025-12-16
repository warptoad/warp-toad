/**
 * L1AztecBridgeAdapter Contract ABI
 * Auto-generated from backend typechain types
 * DO NOT EDIT MANUALLY
 */

export const L1AztecBridgeAdapterAbi = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newGigaRoot",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "key",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "index",
        "type": "uint256"
      }
    ],
    "name": "NewGigaRootSentToAztec",
    "type": "event"
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
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "_newL2Root",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_bridgedL2BlockNumber",
        "type": "uint256"
      }
    ],
    "name": "getContentHash",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure",
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
        "internalType": "bytes32",
        "name": "_newL2Root",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "_bridgedL2BlockNumber",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_witnessL2BlockNumber",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_leafIndex",
        "type": "uint256"
      },
      {
        "internalType": "bytes32[]",
        "name": "_path",
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
    "inputs": [],
    "name": "inbox",
    "outputs": [
      {
        "internalType": "contract IInbox",
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
        "name": "_registry",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "_l2AztecBridgeAdapter",
        "type": "bytes32"
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
    "name": "l2AztecBridgeAdapter",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
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
    "inputs": [],
    "name": "outbox",
    "outputs": [
      {
        "internalType": "contract IOutbox",
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
    "inputs": [],
    "name": "rollup",
    "outputs": [
      {
        "internalType": "contract IRollup",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "rollupVersion",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export type L1AztecBridgeAdapterAbi = typeof L1AztecBridgeAdapterAbi;
