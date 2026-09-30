import { log } from "@graphprotocol/graph-ts"
import { MidasRequestToWithdrawal, Withdraw } from "../generated/schema"
import { SafeApproveRequest } from "../generated/MidasRedemptionVault/MidasRedemptionVault"
import { getOrCreateEvent } from "./utils"

// The Midas Vault settles a redemption request asynchronously - anywhere from
// hours to weeks after it was filed - and pays the tBTC straight to the
// receiver. None of the Acre contracts are involved, so this event is the only
// signal that a withdrawal through the `WithdrawalQueue` has completed.
//
// Handles both `safeApproveRequest` and `approveRequest`; the two events have
// the same shape and only differ in whether the operator overrode the rate.
// eslint-disable-next-line import/prefer-default-export
export function handleApproveRequest(event: SafeApproveRequest): void {
  const midasRequestToWithdrawal = MidasRequestToWithdrawal.load(
    event.params.requestId.toString(),
  )

  if (!midasRequestToWithdrawal) {
    // Most of the vault's requests are not Acre's, and the ones that are but
    // were filed for the Bitcoin path are deliberately not registered - they
    // complete when the tBTC Bridge delivers the BTC.
    return
  }

  // eslint-disable-next-line prefer-destructuring
  const withdrawId = midasRequestToWithdrawal.withdrawId
  const withdraw = Withdraw.load(withdrawId)

  if (!withdraw) {
    // The mapping is only ever written alongside the withdrawal, so this should
    // be unreachable.
    log.error("Cannot find withdraw entity with id {}", [withdrawId])
    return
  }

  // Midas settles at the rate of the moment, which can differ from the amount
  // quoted at request time by a wei of rounding. Not worth digging the exact
  // payout out of the transaction receipt - it is 1e-10 of a satoshi.
  withdraw.amount = withdraw.amountToRedeem

  const eventEntity = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_${withdrawId}_MidasRedeemApproved`,
  )

  eventEntity.activity = withdraw.id
  eventEntity.timestamp = event.block.timestamp
  eventEntity.type = "Finalized"

  withdraw.save()
  eventEntity.save()
}
