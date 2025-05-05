# Relay

This is a small webserver for executing warp toad contract calls for others. This obfuscates the addresses that initiated a warp toad contract call, preserving the user's privacy.

# Running

By default it will run locally at port 8000. Requires env vars `PROVIDER_URL`, `CONTRACT_ADDRESS` and `PRIVATE_KEY`.

After setting your `.env`, source it with `source .env`.
Run with `cargo run` (dev) or `cargo run --release` (prod).

If you run into issues after getting it to work once or twice it's likely your rpc.
