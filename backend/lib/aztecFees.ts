import { Gas } from "@aztec/stdlib/gas";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee";

// Without explicit gas limits the wallet declares the network's per-tx maximum
// (6.54M L2 gas on testnet), and the fee payer must hold maxFeesPerGas x that.
// The sponsored FPC holds far less, so the node rejects the tx with
// "Insufficient fee payer balance". Declaring what a simulation used, plus
// padding for state changes between simulation and inclusion, cuts that ~13x.
// Tx validation is skipped so a duplicate-nullifier error (e.g. an account that
// is already deployed) still comes from send(), where callers handle it.
const GAS_LIMIT_PADDING = 1.1

type Simulatable = { simulate(options: any): Promise<{ gasUsed?: { totalGas: Gas, teardownGas: Gas } }> }

export async function estimateFeeOptions(interaction: Simulatable, from: any, paymentMethod?: SponsoredFeePaymentMethod) {
    const { gasUsed } = await interaction.simulate({ from, fee: { paymentMethod }, includeMetadata: true, skipFeeEnforcement: true, skipTxValidation: true })
    if (!gasUsed) throw new Error("simulation returned no gas usage")
    const pad = (gas: Gas) => new Gas(Math.ceil(gas.daGas * GAS_LIMIT_PADDING), Math.ceil(gas.l2Gas * GAS_LIMIT_PADDING))
    return {
        paymentMethod,
        gasSettings: { gasLimits: pad(gasUsed.totalGas), teardownGasLimits: pad(gasUsed.teardownGas) },
    }
}
