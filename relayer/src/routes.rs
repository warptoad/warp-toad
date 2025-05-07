use crate::types::{
    AppState, CONTRACT_ABI_PATH, MINT_FUNCTION_NAME, MintTransactionRequest, TransactionResponse,
};
use alloy::{
    contract::{CallBuilder, ContractInstance, Interface},
    eips::BlockId,
    json_abi::Function,
    network::Ethereum,
    providers::{DynProvider, Provider},
};
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
    if request.relayer != state.public_key.to_string() {
        let err = format!(
            "The relayer you sent the transaction to doesn't have this public key.  Public key sent: {} relayer's public key {}",
            request.relayer, state.public_key
        );
        println!("Pub key error.  Responding with: {err}");
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
    let call_builder = match contract.function(function_name, &function_args) {
        Ok(c) => c,
        Err(e) => {
            let err = format!("call builder error: {}", e);
            return Json(TransactionResponse {
                success: false,
                txn_hash: None,
                error: Some(err),
            });
        }
    };

    // TODO: make sure transaction is profitable for relayer based on parameters
    if let Some(min_profit_usd) = state.min_profit_usd {
        /*
        let expected_profit = match calculate_expected_profit(state).await {
            Ok(p) => p,
            Err(e) => {
                let err = format!("Error calculating expected relayer profit: {e}");
                println!("{err}");
                return Json(TransactionResponse {
                    success: false,
                    txn_hash: None,
                    error: Some(err),
                });
            }
        };

        if expected_profit < min_profit_usd {
            let err = format!("Transaction not profitable for relayer");
            println!("err");
            return Json(TransactionResponse {
                success: false,
                txn_hash: None,
                error: Some(err),
            });
        }
        */
    }

    let pending_txn_builder = call_builder.send().await;

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

/*
async fn calculate_expected_profit(
    state: &State<AppState>,
    call_builder: CallBuilder<&DynProvider, Function, Ethereum>,
) -> anyhow::Result<f64> {
    // calculate expected profit of the transaction
    // if it's not enough, early return failed txn with the reason
    // contract logic:
    // uint256 _relayerFee = _feeFactor * (block.basefee + _priorityFee); // TODO double check precision. Prob only breaks if the wrpToad token price is super high or gas cost super low

    // This should be equal to the contract's calculated (block.basefee + _priorityFee)
    let estimated_gas = call_builder.estimate_gas().await?;

    let current_block = state.provider.get_block(BlockId::latest()).hashes().await?;

    let expected_profit =
    Ok(estimated_profit)
}
*/
