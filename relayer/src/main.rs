mod routes;

use routes::hello;

mod types;
use alloy::{
    contract::{ContractInstance, Interface},
    dyn_abi::DynSolValue,
    hex::ToHexExt,
    network::EthereumWallet,
    primitives::Address,
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
};
use rocket::{State, post, routes, serde::json::Json};
// use types::TransactionResponse;
// use types::{PrivateTransactionRequest, PublicTransactionRequest};
#[macro_use]
extern crate rocket;
extern crate dotenv;
use anyhow::{Context, Result};

use dotenv::dotenv;
use std::env;

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

    let app_state = AppState {
        provider_url,
        contract_address: contract_address.parse().context("parse address").unwrap(),
        private_key,
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

struct AppState {
    // TODO: use arc<Provider> instead of creating a new provider lol
    // I can't be fucked to deal with alloy types rn
    provider_url: String,
    contract_address: Address,
    private_key: String,
}
