# Relay

This is a small webserver for executing warp toad contract calls for others. This obfuscates the addresses that initiated a warp toad contract call, preserving the user's privacy.

# Running

By default it will run locally at port 8000. Requires env vars `PROVIDER_URL`, `MIN_PROFIT_USD` (min profit to execute a transaction. Leave empty to relay every transaction, even at a loss) `PRIVATE_KEY`, and `PUBLIC_KEY`.

After setting your `.env`, source it with `source .env`.
Run with `cargo run` (dev) or `cargo run --release` (prod).

Runs on port 8000 by default, to change it, change the `port` variable in `Rocket.toml`.

If you run into issues after getting it to work once or twice it's likely your rpc.

# Relaying `mint` transactions

Simply make a post request to this application with a json body. `contract_address` is the address of the warp-toad contract that you're calling mint on and the rest are `mint` function arguments.

```
{
 contract_address: String,
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
```

And the response will be in json with the form:

```
{
    success: bool,
    txn_hash: Option<String>,
    error: Option<String>,
}
```
