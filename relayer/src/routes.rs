use crate::types::{
    AppState, CONTRACT_ABI_PATH, MINT_FUNCTION_NAME, MintTransactionRequest, TransactionResponse,
};
use alloy::contract::{ContractInstance, Interface};
use rocket::{State, post, serde::json::Json};

#[get("/")]
pub fn hello() -> String {
    "Hello!".to_string()
}

#[post("/", format = "json", data = "<request>")]
pub async fn mint(
    request: Json<MintTransactionRequest>,
    state: &State<AppState>,
) -> Json<TransactionResponse> {
    // TODO: make sure transaction is profitable for relayer based on parameters
    if let Some(min_profit_usd) = state.min_profit_usd {
        // calculate expected profit of the transaction
        // if it's not enough, early return failed txn with the reason
        let err = format!("Transaction not profitable for relayer");
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    let artifact = std::fs::read(CONTRACT_ABI_PATH).expect("Failed to read artifact");
    let json: serde_json::Value = serde_json::from_slice(&artifact).unwrap();

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
        println!("{err}");
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    match pending_txn_builder.unwrap().watch().await {
        Ok(txn_hash) => {
            println!("transaction successful! txn_hash: {txn_hash}");
            Json(TransactionResponse {
                success: true,
                txn_hash: Some(txn_hash.to_string()),
                error: None,
            })
        }
        Err(err) => {
            let err = format!("transaction execution error: {}", err);
            println!("{err}");
            Json(TransactionResponse {
                success: false,
                txn_hash: None,
                error: Some(err),
            })
        }
    }
}
