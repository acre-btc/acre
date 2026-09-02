import { Fees, WithdrawalDestination } from "#/types"

/**
 * Reshapes the SDK's withdrawal fee quote for the given destination.
 *
 * The SDK quotes the Bitcoin path, which pays a tBTC Bridge redemption treasury
 * fee on top of the Acre exit fee. The tBTC-to-EVM path redeems straight from
 * the vault and never touches the Bridge, so that part is dropped - and `total`
 * has to be recomputed along with it, or every consumer reading `total`
 * overstates the cost and understates the payout.
 * @param fees Withdrawal fees as returned by `protocol.estimateWithdrawalFee`.
 * @param destination Where the withdrawal is paid out.
 * @returns Fees applicable to `destination`, with a consistent `total`.
 */
function forWithdrawalDestination(
  fees: Fees,
  destination: WithdrawalDestination["type"],
): Fees {
  if (destination === "bitcoin") return fees

  return {
    ...fees,
    tbtc: { fee: 0n, isReimbursable: false },
    total: fees.acre.fee,
  }
}

export default { forWithdrawalDestination }
