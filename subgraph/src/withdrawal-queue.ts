import { BigInt, log } from "@graphprotocol/graph-ts"
import { Withdraw } from "../generated/schema"
import {
  RedeemAndBridgeRequested,
  RedeemFeeRequested,
  RedeemRequested,
  RequestRedeemAndBridgeCall,
} from "../generated/WithdrawalQueue/WithdrawalQueue"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateMidasRequestToWithdrawal,
  getOrCreateWithdraw,
} from "./utils"

// This event is emitted in the same transaction as the `RedemptionRequested`
// event from the `BitcoinRedeemerV2` contract.
export function handleRedeemAndBridgeRequested(
  event: RedeemAndBridgeRequested,
): void {
  const ownerEntity = getOrCreateDepositOwner(event.params.redeemer)

  const withdraw = getOrCreateWithdraw(event.params.requestId.toString())

  withdraw.depositOwner = ownerEntity.id
  withdraw.requestedAmount = event.params.tbtcAmount.plus(
    event.params.exitFeeInTbtc,
  )
  withdraw.amountToRedeem = event.params.tbtcAmount

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedeemAndBridgeRequested`,
  )

  redemptionRequestedEvent.activity = withdraw.id
  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.type = "Requested"

  ownerEntity.save()
  withdraw.save()
  redemptionRequestedEvent.save()
}

export function handleRequestRedeemAndBridgeCall(
  call: RequestRedeemAndBridgeCall,
): void {
  // eslint-disable-next-line no-underscore-dangle
  const redeemerOutputScript = call.inputs._redeemerOutputScript.toHex()
  const withdrawId = call.outputs.requestId.toString()

  const withdrawEntity = Withdraw.load(withdrawId)

  if (withdrawEntity == null) {
    // Event and call triggers within the same transaction are ordered using a
    // convention: event triggers first then call triggers, each type respecting
    // the order they are defined in the manifest. So, not finding the  withdraw
    // entity with the given ID is rather unlikely, but we log an error here
    // just in case. The withdraw entity should be already created in
    // `handleRedeemAndBridgeRequested`.
    log.error("Cannot find withdraw entity with id {}", [withdrawId])
    return
  }

  withdrawEntity.redeemerOutputScript = redeemerOutputScript

  withdrawEntity.save()
}

// `requestedAmount` is the amount to redeem plus the exit fee, but a redemption
// to tBTC reports the two in separate events, so each has to add onto whatever
// the other one already left on the withdrawal. Which of them arrives first
// does not matter, and the fee event is not emitted at all when the exit fee is
// zero - as it is on mainnet today.
function addToRequestedAmount(
  requestedAmount: BigInt | null,
  amount: BigInt,
): BigInt {
  if (requestedAmount === null) {
    return amount
  }

  return requestedAmount.plus(amount)
}

// Emitted by `WithdrawalQueue.requestRedeem` - a redemption paid out in tBTC to
// an Ethereum address rather than bridged to Bitcoin. It carries the amounts
// and the Midas request ID, but the receiver rather than the owner of the
// shares, so unlike `handleRedeemAndBridgeRequested` above this handler cannot
// record the withdrawal on its own.
//
// The owner comes from `acreBTC.RedemptionRequested`, emitted later in the same
// transaction, and that is where the `Requested` event is created - see
// `handleRedemptionRequested` in `acrebtc.ts`. Creating one here as well would
// leave the withdrawal with two `Requested` events for the one request.
export function handleRedeemRequested(event: RedeemRequested): void {
  const withdrawId = event.params.requestId.toString()
  const withdraw = getOrCreateWithdraw(withdrawId)

  withdraw.destination = "Ethereum"
  withdraw.amountToRedeem = event.params.tbtcAmount
  withdraw.requestedAmount = addToRequestedAmount(
    withdraw.requestedAmount,
    event.params.tbtcAmount,
  )

  // Remember which Midas request settles this withdrawal, so the Midas
  // settlement event can find it. Deliberately only done here: the Bitcoin path
  // files a Midas request too, but it is not complete until the tBTC Bridge has
  // delivered the BTC, so it must not be finalized when Midas settles.
  const midasRequestToWithdrawal = getOrCreateMidasRequestToWithdrawal(
    event.params.midasRequestId,
    withdrawId,
  )

  withdraw.save()
  midasRequestToWithdrawal.save()
}

// Emitted by `WithdrawalQueue.requestRedeem` alongside `RedeemRequested`. The
// exit fee is charged on top of the amount the user receives, so it is part of
// the requested amount but not of the amount to redeem.
export function handleRedeemFeeRequested(event: RedeemFeeRequested): void {
  const withdraw = getOrCreateWithdraw(event.params.requestId.toString())

  withdraw.requestedAmount = addToRequestedAmount(
    withdraw.requestedAmount,
    event.params.exitFeeInTbtc,
  )

  withdraw.save()
}
