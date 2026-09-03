import { Hex } from "../utils"
import { ChainIdentifier } from "./chain-identifier"

export interface AcreBTC {
  /**
   * @returns The chain-specific identifier of this contract.
   */
  getChainIdentifier(): ChainIdentifier

  /**
   * @returns Total tBTC amount under AcreBTC contract management in 1e18
   *          precision.
   */
  totalAssets(): Promise<bigint>

  /**
   * @param identifier The generic chain identifier.
   * @returns Value of the basis for calculating final BTC balance.
   */
  balanceOf(identifier: ChainIdentifier): Promise<bigint>

  /**
   * @param identifier The generic chain identifier.
   * @returns Maximum withdraw value.
   */
  assetsBalanceOf(identifier: ChainIdentifier): Promise<bigint>

  /**
   * Calculates the deposit fee taken from each tBTC deposit to the AcreBTC pool
   * which is then transferred to the treasury.
   * @param amount Amount to deposit in 1e18 precision.
   * @returns Deposit fee.
   */
  calculateDepositFee(amount: bigint): Promise<bigint>

  /**
   * Calculates the withdrawal fee taken from each tBTC withdrawal from the AcreBTC
   * pool which is then transferred to the treasury.
   * @param amount Amount to withdraw in 1e18 precision.
   * @returns Withdrawal fee.
   */
  calculateWithdrawalFee(amount: bigint): Promise<bigint>

  /**
   * Encodes the transaction data for a transaction that calls the
   * `approveAndCall` function. The `approveAndCall` function allows `spender`
   * to spend no more than `amount` AcreBTC tokens on user's behalf and then ping
   * the contract about it.
   * @param spender The address authorized to spend.
   * @param shares The max amount they can spend.
   * @param extraData Extra information to send to the approved contract.
   */
  encodeApproveAndCallFunctionData(
    spender: ChainIdentifier,
    shares: bigint,
    extraData: Hex,
  ): Hex

  /**
   * Encodes the transaction data for a transaction that calls the
   * `requestRedeem` function. It moves `shares` from `owner` to the withdrawal
   * queue and requests a redemption of the underlying Midas position, which
   * pays the resulting tBTC out to `receiver`.
   *
   * This is asynchronous - the transaction only registers the request. The
   * tBTC arrives once the Midas redemption settles at the next NAV update.
   *
   * No token approval is involved as long as the caller is the `owner`, in
   * which case the vault does not touch the allowance at all.
   * @param shares Amount of AcreBTC shares to redeem.
   * @param receiver The address that will receive the tBTC, as a string in
   *        whichever format the target chain uses. The implementation parses
   *        and validates it, so callers need not know the chain.
   * @param owner The address the shares are taken from.
   */
  encodeRequestRedeemFunctionData(
    shares: bigint,
    receiver: string,
    owner: ChainIdentifier,
  ): Hex

  /**
   * Finds the redemption request id created by the given transaction, by
   * reading the `RedemptionRequested` event from its receipt.
   * @param transactionHash Hash of the transaction that called
   *        `requestRedeem`.
   */
  findRedemptionRequestIdFromTransaction(transactionHash: Hex): Promise<bigint>

  /**
   * Calculates the amount of tBTC that will be redeemed for the given amount
   * of AcreBTC shares.
   * @param shares Amount of AcreBTC shares to redeem.
   */
  previewRedeem(shares: bigint): Promise<bigint>

  /**
   * Converts the tBTC amount to AcreBTC shares.
   * @param amount Amount of tBTC.
   */
  convertToShares(amount: bigint): Promise<bigint>
}
