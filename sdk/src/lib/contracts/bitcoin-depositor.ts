import { Hex } from "../utils"
import { ChainIdentifier } from "./chain-identifier"
import { DepositorProxy } from "./depositor-proxy"

export type DecodedExtraData = {
  depositOwner: ChainIdentifier
  referral: number
}

/**
 * Represents the Acre protocol deposit fees.
 */
type AcreDepositFees = {
  /**
   * The Acre protocol depositor fee taken from each Bitcoin deposit and
   * transferred to the treasury upon deposit request finalization.
   */
  bitcoinDepositorFee: bigint
}

export type DepositFees = {
  acre: AcreDepositFees
}

/**
 * Interface for communication with the BitcoinDepositor on-chain contract.
 */
export interface BitcoinDepositor extends DepositorProxy {
  /**
   * @returns The chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier

  /**
   * @returns The chain-specific identifier for tBTC vault contract.
   */
  getTbtcVaultChainIdentifier(): Promise<ChainIdentifier>

  /**
   * Encodes deposit owner address and referral as extra data.
   * @param depositOwner The address to which the acreBTC shares will be minted.
   * @param referral Data used for referral program.
   */
  encodeExtraData(depositOwner: ChainIdentifier, referral: number): Hex

  /**
   * Decodes depositOwner address and referral from extra data.
   * @param extraData Encoded extra data.
   */
  decodeExtraData(extraData: string): DecodedExtraData

  /**
   * Calculates the deposit fee based on the provided amount.
   * @param amountToDeposit Amount to deposit in 1e18 token precision.
   * @returns Deposit fees grouped by tBTC and Acre protocols in 1e18 tBTC token
   *          precision.
   */
  calculateDepositFee(amountToDeposit: bigint): Promise<DepositFees>

  /**
   * @returns Minimum deposit amount.
   */
  minDepositAmount(): Promise<bigint>
}
