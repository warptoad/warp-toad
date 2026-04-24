/**
 * Persistent claim ledger for the faucet.
 *
 * Stores per-(address, chainId) claim records in a JSON file. Reads on startup,
 * writes synchronously on each `recordClaim` call. Plenty fast for testnet load
 * (we're talking hundreds of claims, not millions).
 */
import fs from "fs";
import path from "path";

export interface ClaimRecord {
	chainId: number;
	txHash: string;
	timestamp: number;
}

interface FaucetLedgerData {
	claims: Record<string, ClaimRecord[]>;
}

export class LedgerStore {
	private readonly filePath: string;
	private data: FaucetLedgerData;

	constructor(filePath: string) {
		this.filePath = filePath;
		fs.mkdirSync(path.dirname(filePath), { recursive: true });
		if (fs.existsSync(filePath)) {
			try {
				this.data = JSON.parse(fs.readFileSync(filePath, "utf8"));
				if (!this.data.claims) this.data = { claims: {} };
			} catch (err) {
				console.warn(`[ledger] failed to parse ${filePath}, starting fresh:`, err);
				this.data = { claims: {} };
			}
		} else {
			this.data = { claims: {} };
		}
	}

	private key(address: string): string {
		return address.toLowerCase();
	}

	hasClaimed(address: string, chainId: number): boolean {
		const claims = this.data.claims[this.key(address)] ?? [];
		return claims.some((c) => c.chainId === chainId);
	}

	getClaim(address: string, chainId: number): ClaimRecord | null {
		const claims = this.data.claims[this.key(address)] ?? [];
		return claims.find((c) => c.chainId === chainId) ?? null;
	}

	getAllClaims(address: string): ClaimRecord[] {
		return this.data.claims[this.key(address)] ?? [];
	}

	recordClaim(address: string, chainId: number, txHash: string): void {
		const k = this.key(address);
		if (!this.data.claims[k]) this.data.claims[k] = [];
		this.data.claims[k].push({ chainId, txHash, timestamp: Date.now() });
		this.flush();
	}

	private flush(): void {
		fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
	}

	totalClaims(): number {
		return Object.values(this.data.claims).reduce((sum, arr) => sum + arr.length, 0);
	}
}
