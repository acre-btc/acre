import { ChainIdentifier } from "./chain-identifier"

export type RedeemerWithdrawalFees = {
  tbtc: { treasuryFee: bigint }
}

export interface BitcoinRedeemer {
  /**
   * @returns The chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier

  /**
   * Calculates the withdrawal fee based on the provided amount.
   * @param amountToWithdraw Amount to withdraw in 1e18 token precision.
   * @returns Withdrawal fees grouped by tBTC and Acre protocols in 1e18 tBTC token
   *          precision.
   */
  calculateWithdrawalFee(
    amountToWithdraw: bigint,
  ): Promise<RedeemerWithdrawalFees>
}
