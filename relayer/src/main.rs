mod routes;

use routes::hello;

mod types;
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
use types::AppState;
// use types::TransactionResponse;
// use types::{PrivateTransactionRequest, PublicTransactionRequest};
#[macro_use]
extern crate rocket;
extern crate dotenv;
use anyhow::{Context, Result};

use dotenv::dotenv;
use std::{env, sync::Arc};

#[rocket::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let provider_url = env::var("PROVIDER_URL")
        .context("set PROVIDER_URL in a .env file")
        .unwrap();
    println!("provider url: {provider_url}");
    let contract_address = env::var("CONTRACT_ADDRESS")
        .context("set CONTRACT_ADDRESS in a .env file")
        .unwrap();
    println!("contract address: {contract_address}");
    let private_key = env::var("PRIVATE_KEY")
        .context("set PRIVATE_KEY in a .env file")
        .unwrap();

    // leave unset for altruistic relayer
    let min_profit_usd: Option<f64> = env::var("MIN_PROFIT_USD").map_or_else(
        |_| None,
        |amt| Some(amt.parse().context("parse MIN_PROFIT_USD as f64").unwrap()),
    );

    let signer: PrivateKeySigner = private_key.parse().expect("should parse private key");
    let wallet = EthereumWallet::from(signer.clone());

    let provider = ProviderBuilder::new()
        .wallet(wallet)
        .connect_http(provider_url.parse().unwrap())
        .erased();

    let app_state = AppState {
        provider,
        contract_address: contract_address.parse().context("parse address").unwrap(),
        min_profit_usd,
    };

    let _ = rocket::build()
        // .attach(Cors)
        .manage(app_state)
        .mount("/", routes![hello])
        // .mount("/private_transfer", routes![private_transfer])
        // .mount("/public_transfer", routes![public_transfer])
        .configure(rocket::Config::figment().merge(("address", "0.0.0.0")))
        .launch()
        .await?;

    Ok(())
}
