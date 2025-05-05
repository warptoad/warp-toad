use crate::types::{
    AppState, CONTRACT_ABI_PATH, MINT_FUNCTION_NAME, MintTransactionRequest, TransactionResponse,
};
use alloy::{
    contract::{ContractInstance, Interface},
    dyn_abi::DynSolValue,
    hex::ToHexExt,
    network::{Ethereum, EthereumWallet},
    primitives::Address,
    providers::{Provider, ProviderBuilder, ReqwestProvider},
    signers::local::PrivateKeySigner,
};
use rocket::{State, post, routes, serde::json::Json};

#[get("/")]
pub fn hello() -> String {
    "Hello!".to_string()
}

#[post("/", format = "json", data = "<request>")]
async fn mint(
    request: Json<MintTransactionRequest>,
    state: &State<AppState>,
) -> Json<TransactionResponse> {
    let artifact = std::fs::read(CONTRACT_ABI_PATH).expect("Failed to read artifact");
    let json: serde_json::Value = serde_json::from_slice(&artifact).unwrap();

    // Get `abi` from the artifact.
    let abi_value = json.get("abi").expect("Failed to get ABI from artifact");
    let abi = serde_json::from_str(&abi_value.to_string()).unwrap();

    let contract_address = state.contract_address;
    let contract = ContractInstance::new(
        contract_address,
        state.provider.clone(),
        Interface::new(abi),
    );

    let function_name = MINT_FUNCTION_NAME;
    let function_args = request.to_args();
    let call_builder = contract.function(function_name, &function_args);

    if let Err(err) = call_builder {
        let err = format!("call builder error: {}", err);
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    let pending_txn_builder = call_builder.unwrap().send().await;

    if let Err(err) = pending_txn_builder {
        let err = format!("pending transaction builder error: {}", err);
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    match pending_txn_builder.unwrap().watch().await {
        Ok(txn_hash) => {
            let txn_hash = txn_hash.encode_hex();
            println!("transaction successful! txn_hash: {txn_hash}");
            Json(TransactionResponse {
                success: true,
                txn_hash: Some(txn_hash),
                error: None,
            })
        }
        Err(err) => {
            let err = format!("transaction execution error: {}", err);
            Json(TransactionResponse {
                success: false,
                txn_hash: None,
                error: Some(err),
            })
        }
    }
}

/*
async fn transfer_logic(
    function_name: &str,
    function_args: &[DynSolValue],
    state: &State<AppState>,
) -> Json<TransactionResponse> {
    let signer: PrivateKeySigner = state.private_key.parse().expect("should parse private key");
    let wallet = EthereumWallet::from(signer.clone());

    let provider_url = state.provider_url.clone();
    let provider = ProviderBuilder::new()
        .wallet(wallet)
        .on_http(provider_url.parse().unwrap());

    // Read the artifact which contains `abi`, `bytecode`, `deployedBytecode` and `metadata`.
    let artifact = std::fs::read(CONTRACT_ABI_PATH).expect("Failed to read artifact");
    let json: serde_json::Value = serde_json::from_slice(&artifact).unwrap();

    // Get `abi` from the artifact.
    let abi_value = json.get("abi").expect("Failed to get ABI from artifact");
    let abi = serde_json::from_str(&abi_value.to_string()).unwrap();

    let contract_address = state.contract_address;
    let contract = ContractInstance::new(contract_address, provider.clone(), Interface::new(abi));

    let call_builder = contract.function(function_name, function_args);

    if let Err(err) = call_builder {
        let err = format!("call builder error: {}", err);
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    let pending_txn_builder = call_builder.unwrap().send().await;

    if let Err(err) = pending_txn_builder {
        let err = format!("pending transaction builder error: {}", err);
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    match pending_txn_builder.unwrap().watch().await {
        Ok(txn_hash) => {
            let txn_hash = txn_hash.encode_hex();
            Json(TransactionResponse {
                success: true,
                txn_hash: Some(txn_hash),
                error: None,
            })
        }
        Err(err) => {
            let err = format!("transaction execution error: {}", err);
            Json(TransactionResponse {
                success: false,
                txn_hash: None,
                error: Some(err),
            })
        }
    }
}

#[post("/", format = "json", data = "<request>")]
async fn private_transfer(
    request: Json<PrivateTransactionRequest>,
    state: &State<AppState>,
) -> Json<TransactionResponse> {
    let args = request.to_args();
    transfer_logic("privateTransfer", &args, state).await
}
*/
