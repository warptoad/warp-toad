
export type ChainConfig = {
  id: string;
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  svg?: string;
};

export const CHAINS: ChainConfig[] = [
  {
      id: "sepolia",
      chainId: "0xaa36a7",
      chainName: "Sepolia Testnet",
      nativeCurrency: {
        name: "Sepolia Ether",
        symbol: "ETH",
        decimals: 18
      },
      rpcUrls: ["https://rpc.sepolia.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
      svg: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTIiIGhlaWdodD0iNTIiIHZpZXdCb3g9IjAgMCA1MiA1MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyNiIgY3k9IjI2IiByPSIyNiIgZmlsbD0iIzAwNTJGRiIvPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI2LDI2KSBzY2FsZSgwLjc1KSB0cmFuc2xhdGUoLTI2LC0yNikiPgogICAgPHBhdGggZD0iTTI1LjYyMzggMEwyNS4yNjA3IDEuMTg0OTJWMzUuNTY4NUwyNS42MjM4IDM1LjkxNjVMNDIuMjQ3NyAyNi40ODIzTDI1LjYyMzggMFoiIGZpbGw9IiNlM2UzZTMiLz4KICAgIDxwYXRoIGQ9Ik0yNS42MjM5IDBMOSAyNi40ODIzTDI1LjYyMzkgMzUuOTE2NlYxOS4yMjc4VjBaIiBmaWxsPSIjZjNmM2YzIi8+CiAgICA8cGF0aCBkPSJNMjUuNjIzOCAzOC45Mzg1TDI1LjQxOTIgMzkuMTc3OVY1MS40MjYxTDI1LjYyMzggNTJMNDIuMjU3NiAyOS41MDlMMjUuNjIzOCAzOC45Mzg1WiIgZmlsbD0iI2UzZTNlMyIvPgogICAgPHBhdGggZD0iTTI1LjYyMzkgNTEuOTk5OFYzOC45MzgzTDkgMjkuNTA4OEwyNS42MjM5IDUxLjk5OThaIiBmaWxsPSIjZjNmM2YzIi8+CiAgICA8cGF0aCBkPSJNMjUuNjIzOCAzNS45MTY0TDQyLjI0NzQgMjYuNDgyNEwyNS42MjM4IDE5LjIyNzlWMzUuOTE2NFoiIGZpbGw9IiNkM2QzZDMiLz4KICAgIDxwYXRoIGQ9Ik05LjAwMDEyIDI2LjQ4MjRMMjUuNjIzOCAzNS45MTY1VjE5LjIyOEw5LjAwMDEyIDI2LjQ4MjRaIiBmaWxsPSIjZTNlM2UzIi8+ICAKICA8L2c+CiAgPC9zdmc+Cg=="
  },
  {
      id: "base",
      chainId: "0x14a34",
      chainName: "Base Sepolia Testnet",
      nativeCurrency: {
        name: "Base Sepolia Ether",
        symbol: "ETH",
        decimals: 18
      },
      rpcUrls: ["https://sepolia.base.org"],
      blockExplorerUrls: ["https://sepolia.basescan.org"],
      svg: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSIxMjAwIiB2aWV3Qm94PSIwIDAgMTIwMCAxMjAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBkPSJNNjAwIDEyMDBDNzE4LjY2OSAxMjAwIDgzNC42NzMgMTE2NC44MSA5MzMuMzQyIDEwOTguODhDMTAzMi4wMSAxMDMyLjk1IDExMDguOTEgOTM5LjI0NiAxMTU0LjMzIDgyOS42MUMxMTk5Ljc0IDcxOS45NzUgMTIxMS42MiA1OTkuMzM1IDExODguNDcgNDgyLjk0NkMxMTY1LjMyIDM2Ni41NTcgMTEwOC4xOCAyNTkuNjQ4IDEwMjQuMjYgMTc1LjczNkM5NDAuMzUyIDkxLjgyNDcgODMzLjQ0MyAzNC42ODAyIDcxNy4wNTQgMTEuNTI5MUM2MDAuNjY1IC0xMS42MjIgNDgwLjAyNiAwLjI1OTk3NCAzNzAuMzkgNDUuNjcyNUMyNjAuNzU0IDkxLjA4NTEgMTY3LjA0NyAxNjcuOTg5IDEwMS4xMTggMjY2LjY1OEMzNS4xODk0IDM2NS4zMjggMCA0ODEuMzMxIDAgNjAwQzAgNzU5LjEzIDYzLjIxNDEgOTExLjc0MiAxNzUuNzM2IDEwMjQuMjZDMjg4LjI1OCAxMTM2Ljc5IDQ0MC44NyAxMjAwIDYwMCAxMjAwWiIgZmlsbD0iIzAwNTJGRiIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTU5OC41ODggMTAyMi41NEM4MzEuOTQ3IDEwMjIuNTQgMTAyMS4xMiA4MzMuMzYgMTAyMS4xMiA2MDBDMTAyMS4xMiAzNjYuNjQgODMxLjk0NyAxNzcuNDY1IDU5OC41ODggMTc3LjQ2NUMzNzcuMjAzIDE3Ny40NjUgMTk1LjU4NSAzNDcuNzIyIDE3Ny41MjcgNTY0LjQ0Mkg4MDQuNTRWNjM0LjgwMUgxNzcuNDY1QzE5NS4xNjIgODUxLjg4MSAzNzYuOTQ2IDEwMjIuNTQgNTk4LjU4OCAxMDIyLjU0WiIgZmlsbD0iI2YzZjNmMyIvPgo8L3N2Zz4K"
  }
];
