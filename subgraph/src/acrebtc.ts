import { Address, dataSource } from "@graphprotocol/graph-ts"
import {
  Deposit as DepositEvent,
  RedemptionRequested as RedemptionRequestedEvent,
  Withdraw as WithdrawEvent,
} from "../generated/AcreBTC/AcreBTC"
import {
  getOrCreateDepositOwner,
  getOrCreateDeposit,
  getOrCreateEvent,
  getOrCreateWithdraw,
} from "./utils"

export function handleDeposit(event: DepositEvent): void {
  const stbtcContractAddress = Address.fromBytes(
    dataSource.context().getBytes("stbtcContractAddress"),
  )

  if (!event.params.sender.equals(stbtcContractAddress)) {
    // This is not a migrated deposit - skip this event.
    return
  }

  const depositOwnerEntity = getOrCreateDepositOwner(event.params.owner)
  const depositEntity = getOrCreateDeposit(
    `${event.transaction.hash.toHexString()}_${event.logIndex.toString()}`,
  )

  depositEntity.depositOwner = depositOwnerEntity.id
  depositEntity.initialDepositAmount = event.params.assets
  depositEntity.amountToDeposit = event.params.assets

  const eventEntity = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_${event.logIndex.toString()}_StBtcToAcreBtcDeposit`,
  )

  eventEntity.activity = depositEntity.id
  eventEntity.timestamp = event.block.timestamp
  eventEntity.type = "Migrated"

  depositOwnerEntity.save()
  depositEntity.save()
  eventEntity.save()
}

// Emitted by `acreBTC.requestRedeem`, which redeems shares for tBTC paid out to
// an Ethereum address through the Midas `WithdrawalQueue`. The queue's own
// `RedeemRequested` event carries the amounts but not the owner, so the two
// halves of the withdrawal are assembled from both - see
// `handleRedeemRequested`. The queue emits first, this event second, but both
// handlers create-or-update so the order does not matter.
//
// This is the only event of the pair that knows the owner, so it is the one
// that records the request. The Bitcoin path does the same from the queue
// side, where `RedeemAndBridgeRequested` does carry the owner.
export function handleRedemptionRequested(
  event: RedemptionRequestedEvent,
): void {
  const depositOwnerEntity = getOrCreateDepositOwner(event.params.owner)
  const withdrawEntity = getOrCreateWithdraw(event.params.requestId.toString())

  withdrawEntity.depositOwner = depositOwnerEntity.id
  withdrawEntity.destination = "Ethereum"

  // Namespaced by request id: one transaction can carry more than one
  // `requestRedeem` call, and `${tx}_RedemptionRequested` alone is also the id
  // `tbtc-bridge.ts` builds for the tBTC Bridge event of the same name.
  const eventEntity = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_${event.params.requestId.toString()}_RedemptionRequested`,
  )

  eventEntity.activity = withdrawEntity.id
  eventEntity.timestamp = event.block.timestamp
  eventEntity.type = "Requested"

  depositOwnerEntity.save()
  withdrawEntity.save()
  eventEntity.save()
}

// The ERC4626 `Withdraw` event, emitted by `acreBTC.redeem` or
// `acreBTC.withdraw`. This is the exit path once
// `MidasAllocator.emergencyWithdraw()` has moved the tBTC back onto acreBTC and
// the withdrawal queue is no longer set: the tBTC is paid straight to the
// receiver in a single transaction, so the withdrawal is requested and
// finalized at once.
export function handleWithdraw(event: WithdrawEvent): void {
  // `BitcoinRedeemerV3` redeems the shares to itself and then asks the tBTC
  // Bridge to bridge the tBTC to Bitcoin, so this same event also covers
  // redemptions that never reach an Ethereum address. Those are indexed from
  // the redeemer's own `RedemptionRequested` event instead - recording them
  // here would label a Bitcoin withdrawal as a tBTC one, finalize it at
  // request time while the BTC is still in the Bridge, and duplicate the
  // entity the redeemer's handler creates.
  const bitcoinRedeemerV3ContractAddress = Address.fromBytes(
    dataSource.context().getBytes("bitcoinRedeemerV3ContractAddress"),
  )

  if (event.params.receiver.equals(bitcoinRedeemerV3ContractAddress)) {
    return
  }

  const depositOwnerEntity = getOrCreateDepositOwner(event.params.owner)

  // There is no request ID on this path - the redemption is not queued - so the
  // withdrawal is keyed by the log that created it.
  const withdrawId = `${event.transaction.hash.toHexString()}_${event.logIndex.toString()}`
  const withdrawEntity = getOrCreateWithdraw(withdrawId)

  withdrawEntity.depositOwner = depositOwnerEntity.id
  withdrawEntity.destination = "Ethereum"
  // `assets` is what the receiver is actually paid, net of the exit fee. The
  // fee goes to the treasury in a separate transfer and is not part of this
  // event, so the requested and redeemed amounts are the same figure here.
  withdrawEntity.requestedAmount = event.params.assets
  withdrawEntity.amountToRedeem = event.params.assets
  withdrawEntity.amount = event.params.assets

  const requestedEventEntity = getOrCreateEvent(
    `${withdrawId}_WithdrawRequested`,
  )
  requestedEventEntity.activity = withdrawEntity.id
  requestedEventEntity.timestamp = event.block.timestamp
  requestedEventEntity.type = "Requested"

  const finalizedEventEntity = getOrCreateEvent(
    `${withdrawId}_WithdrawFinalized`,
  )
  finalizedEventEntity.activity = withdrawEntity.id
  finalizedEventEntity.timestamp = event.block.timestamp
  finalizedEventEntity.type = "Finalized"

  depositOwnerEntity.save()
  withdrawEntity.save()
  requestedEventEntity.save()
  finalizedEventEntity.save()
}
