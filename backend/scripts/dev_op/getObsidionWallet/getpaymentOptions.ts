import { FeeJuicePaymentMethod, PXE, SendMethodOptions } from "@aztec/aztec.js"
import { GasSettings } from "@aztec/stdlib/gas"
import { AddressStorage } from "src/backend"
import { assert } from "ts-essentials"
import { ObsidionFeeJuicePaymentMethod } from "@obsidion/kernel"
import { FEE_MULTIPLIER } from "@obsidion/kernel"

export async function getPaymentOptions(pxe: PXE, isObsidionDeployerSender = false) {
  const fpcAddress = await AddressStorage.getFpcAddress()
  assert(fpcAddress, "FPC address not found")

  console.log("fpcAddress: ", fpcAddress.toString())

  // if the tx is sent by the obsidion deployer, use the fee juice payment method
  // otherwise, use the obsidion fee juice payment method
  const paymentMethod = isObsidionDeployerSender
    ? new FeeJuicePaymentMethod(fpcAddress)
    : new ObsidionFeeJuicePaymentMethod(fpcAddress, pxe)
  const gasSettings = GasSettings.default({
    maxFeesPerGas: (await pxe.getCurrentBaseFees()).mul(FEE_MULTIPLIER),
  })
  const options: SendMethodOptions = {
    fee: { paymentMethod, gasSettings },
  }
  return options
}