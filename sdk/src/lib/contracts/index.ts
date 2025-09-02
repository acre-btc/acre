import { BitcoinDepositor } from "./bitcoin-depositor"
import { AcreBTC } from "./acrebtc"
import { BitcoinRedeemer } from "./bitcoin-redeemer"

export * from "./bitcoin-depositor"
export * from "./chain-identifier"
export * from "./acrebtc"
export * from "./depositor-proxy"
export * from "./bitcoin-redeemer"

/**
 * Represents all contracts that allow interaction with the Acre network.
 */
export type AcreContracts = {
  bitcoinDepositor: BitcoinDepositor
  acreBTC: AcreBTC
  bitcoinRedeemer: BitcoinRedeemer
}
