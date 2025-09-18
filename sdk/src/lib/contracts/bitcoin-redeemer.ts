import { Hex } from "../utils"
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

  /**
   * Encodes the extra data for a transaction that redeems shares for
   * tBTC and requests bridging to Bitcoin.
   * @param redeemer Chain identifier of the redeemer. This is the address
   *                 that will be able to claim the tBTC tokens if anything
   *                 goes wrong during the redemption process.
   * @param redeemerOutputScript The output script for the Bitcoin redeemer.
   */
  encodeReceiveApprovalExtraData(
    redeemer: ChainIdentifier,
    redeemerOutputScript: Hex,
  ): Hex

  /**
   * Finds the redemption request ID from a given transaction.
   * @param transactionHash The transaction hash in which the redeem request was
   *                        executed.
   */
  findRedemptionRequestIdFromTransaction(transactionHash: Hex): Promise<bigint>
}
