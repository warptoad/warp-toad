import type { DeployerMetadata } from "aztec-scan-sdk";

export const AZTEC_SCAN_METADATA: Record<string, Omit<DeployerMetadata, "contractIdentifier">> = {
    AztecWarpToad: {
        details: "WarpToad core contract on Aztec, allows fully shielded bridge transaction from and to aztec!",
        creatorName: "warp-toad",
        creatorContact: "",
        appUrl: "https://warptoad.xyz",
        repoUrl: "https://github.com/warptoad/warp-toad",
        aztecScanNotes: {
            name: "AztecWarpToad",
            origin: "warp-toad",
            comment: "",
        },
    },
    L2AztecBridgeAdapter: {
        details: "Aztec-side bridge adapter, bridges the note-hash-tree root of aztec (acting as L2 local root) to the L1AztecAdapter",
        creatorName: "warp-toad",
        creatorContact: "",
        appUrl: "https://warptoad.xyz",
        repoUrl: "https://github.com/warptoad/warp-toad",
        aztecScanNotes: {
            name: "L2AztecBridgeAdapter",
            origin: "warp-toad",
            comment: "",
        },
    },
};
