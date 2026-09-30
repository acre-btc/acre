import { RedemptionRequested } from "../generated/BitcoinRedeemerV3/BitcoinRedeemerV3"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateWithdraw,
} from "./utils"
import { buildBitcoinRedeemerV3WithdrawId } from "./bitcoin-redeemer-v3-utils"

// `BitcoinRedeemerV3` redeems acreBTC for tBTC and hands the tBTC to the tBTC
// Bridge in a single transaction - unlike `BitcoinRedeemerV2`, it does not wait
// on the Midas withdrawal queue. That only removes the queue, though: the
// Bitcoin itself still arrives later, once a tBTC wallet sweeps the redemption
// and a redemption proof is submitted. So this event is the `Requested` stage
// only; `Initialized` and `Finalized` come from `tbtc-bridge.ts`, which finds
// this same log in the transaction receipt to recognise the redemption as
// Acre's.
//
// Not being queued also means there is no request id, so the withdrawal is
// keyed by the log that created it.
// eslint-disable-next-line import/prefer-default-export
export function handleRedemptionRequested(event: RedemptionRequested): void {
  const ownerEntity = getOrCreateDepositOwner(event.params.owner)

  const withdrawId = buildBitcoinRedeemerV3WithdrawId(
    event.transaction.hash,
    event.logIndex,
  )
  const withdraw = getOrCreateWithdraw(withdrawId)

  withdraw.depositOwner = ownerEntity.id
  // `destination` keeps the `Bitcoin` default from `getOrCreateWithdraw`.
  //
  // `tbtcAmount` is what acreBTC paid the redeemer, net of the exit fee. The
  // tBTC Bridge deducts its own treasury and transaction fees on top, so the
  // Bitcoin the user finally receives is less than this.
  withdraw.requestedAmount = event.params.tbtcAmount
  withdraw.amountToRedeem = event.params.tbtcAmount

  const eventEntity = getOrCreateEvent(`${withdrawId}_RedemptionRequested`)

  eventEntity.activity = withdraw.id
  eventEntity.timestamp = event.block.timestamp
  eventEntity.type = "Requested"

  ownerEntity.save()
  withdraw.save()
  eventEntity.save()
}
