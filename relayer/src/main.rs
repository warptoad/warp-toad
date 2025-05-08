mod cors;
mod routes;

use routes::{hello, mint};

mod types;
use alloy::{
    network::EthereumWallet,
    providers::{Provider, ProviderBuilder},
    signers::local::PrivateKeySigner,
};
use cors::Cors;
use rocket::routes;
use types::AppState;

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
    let public_key = env::var("PUBLIC_KEY")
        .context("set PUBLIC_KEY in a .env file")
        .unwrap();
    println!("public key: {public_key}");

    // leave unset for altruistic relayer
    let min_profit_usd: Option<f64> = env::var("MIN_PROFIT_USD").map_or_else(
        |_| {
            println!("MIN_PROFIT_USD not set. Relayer will act altruistically and relay any transaction it receives");
            None
        },
        |amt| Some(amt.parse().context("parse MIN_PROFIT_USD as f64").unwrap()),
    );
    println!("min profit usd: {min_profit_usd:?}");

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
        public_key: public_key.parse().context("parse address").unwrap(),
    };

    let _ = rocket::build()
        .attach(Cors)
        .manage(app_state)
        .mount("/", routes![hello])
        .mount("/mint", routes![mint])
        .configure(rocket::Config::figment().merge(("address", "0.0.0.0")))
        .launch()
        .await?;

    Ok(())
}
