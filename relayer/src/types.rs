use alloy::{
    primitives::{Address, Bytes, Uint},
    providers::DynProvider,
};
use serde::{Deserialize, Serialize};

pub struct AppState {
    pub provider: DynProvider,
    pub min_profit_usd: Option<f64>,
    // pub key of this relayer
    pub public_key: Address,
}

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub success: bool,
    pub txn_hash: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MintTransactionRequest {
    pub contract_address: Address,
    pub args: MintArgs,
}

#[derive(Debug, Deserialize)]
pub struct MintArgs {
    pub nullifier: Uint<256, 4>,
    pub amount: Uint<256, 4>,
    pub giga_root: Uint<256, 4>,
    pub local_root: Uint<256, 4>,
    pub fee_factor: Uint<256, 4>,
    pub priority_fee: Uint<256, 4>,
    pub max_fee: Uint<256, 4>,
    pub relayer: Address,
    pub recipient: Address,
    pub proof: Bytes,
}
