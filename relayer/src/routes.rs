use crate::types::{AppState, MintTransactionRequest, TransactionResponse};
use WarpToadCore::WarpToadCoreInstance;
use alloy::sol;
use rocket::{State, post, serde::json::Json};

#[get("/")]
pub fn hello() -> String {
    "Hello!".to_string()
}

// function we'll be calling
sol!(
    #[sol(rpc)]
    // solc v0.8.26; solc WarpToadCore.sol --bin
    contract WarpToadCore {
        function mint(
            uint256 _nullifier,
            uint256 _amount,
            uint256 _gigaRoot,
            uint256 _localRoot,
            uint256 _feeFactor,
            uint256 _priorityFee,
            uint256 _maxFee,
            address _relayer,
            address _recipient,
            bytes memory _poof
        ) public;
    }
);

#[post("/", format = "json", data = "<request>")]
pub async fn mint(
    request: Json<MintTransactionRequest>,
    state: &State<AppState>,
) -> Json<TransactionResponse> {
    if request.args.relayer != state.public_key {
        let err = format!(
            "The relayer you sent the transaction to doesn't have this public key.  Public key sent: {} relayer's public key {}",
            request.args.relayer, state.public_key
        );
        println!("Pub key error.  Responding with: {err}");
        return Json(TransactionResponse {
            success: false,
            txn_hash: None,
            error: Some(err),
        });
    }

    let contract = WarpToadCoreInstance::new(request.contract_address, state.provider.clone());

    let args = &request.args;
    let call_builder = contract.mint(
        args.nullifier,
        args.amount,
        args.giga_root,
        args.local_root,
        args.fee_factor,
        args.priority_fee,
        args.max_fee,
        args.relayer,
        args.recipient,
        args.proof.clone(),
    );

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
