use alloy::{dyn_abi::DynSolValue, primitives::Address, providers::DynProvider};
use serde::{Deserialize, Serialize};

// TODO:
pub const CONTRACT_ABI_PATH: &str =
    "../ignition/deployments/chain-11155111/artifacts/UltraAnonModule#UltraAnon.json";

pub const MINT_FUNCTION_NAME: &str = "mint";

pub struct AppState {
    pub provider: DynProvider,
    pub contract_address: Address,
    pub min_profit_usd: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub success: bool,
    pub txn_hash: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MintTransactionRequest {
    nullifier: String,
    amount: String,
    giga_root: String,
    local_root: String,
    fee_factor: String,
    priority_fee: String,
    max_fee: String,
    relayer: String,
    recipient: String,
    proof: String,
}

impl MintTransactionRequest {
    pub fn to_args(&self) -> Vec<DynSolValue> {
        vec![
            // Convert numeric strings to DynSolValue::Uint
            DynSolValue::Uint(self.nullifier.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.amount.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.giga_root.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.local_root.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.fee_factor.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.priority_fee.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(self.max_fee.parse().expect("Invalid value"), 256),
            // convert to solidity addresses
            DynSolValue::Address(self.relayer.parse().expect("Invalid address")),
            DynSolValue::Address(self.recipient.parse().expect("Invalid address")),
            // Convert proof string (likely hex) to DynSolValue::Bytes
            DynSolValue::Bytes(hex::decode(&self.proof).expect("Invalid proof hex")),
        ]
    }
}
