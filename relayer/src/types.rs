use alloy::{
    contract::{ContractInstance, Interface},
    dyn_abi::DynSolValue,
    hex::ToHexExt,
    network::EthereumWallet,
    primitives::Address,
    providers::{DynProvider, Provider, RootProvider},
    signers::local::PrivateKeySigner,
};
use std::sync::Arc;

pub struct AppState {
    // TODO: use arc<Provider> instead of creating a new provider lol
    // I can't be fucked to deal with alloy types rn
    pub provider: DynProvider,
    pub contract_address: Address,
    pub private_key: String,
}

/*
#[derive(Debug, Deserialize)]
pub struct PublicTransactionRequest {
    to: String,
    value: String,
    nullifier_value: String,
    nullifier_key: String,
    shadow_balance_root: String,
    incoming_balance_root: String,
    owner: String,
    proof: String,
}

impl PublicTransactionRequest {
    pub fn to_args(&self) -> Vec<DynSolValue> {
        vec![
            // Convert address string to DynSolValue
            DynSolValue::Address(self.to.parse().expect("Invalid address")),
            // Convert numeric strings to DynSolValue::Uint
            DynSolValue::Uint(self.value.parse().expect("Invalid value"), 256),
            DynSolValue::Uint(
                self.nullifier_value
                    .parse()
                    .expect("Invalid nullifier value"),
                256,
            ),
            DynSolValue::Uint(
                self.nullifier_key.parse().expect("Invalid nullifier key"),
                256,
            ),
            DynSolValue::Uint(
                self.shadow_balance_root
                    .parse()
                    .expect("Invalid shadow balance root"),
                256,
            ),
            DynSolValue::Uint(
                self.incoming_balance_root
                    .parse()
                    .expect("Invalid incoming balance root"),
                256,
            ),
            DynSolValue::Address(self.owner.parse().expect("Invalid address")),
            // Convert proof string (likely hex) to DynSolValue::Bytes
            DynSolValue::Bytes(hex::decode(&self.proof).expect("Invalid proof hex")),
        ]
    }
}
*/
