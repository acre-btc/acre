import { Address, dataSource } from "@graphprotocol/graph-ts"
import {
  Deposit as DepositEvent,
  RedemptionRequested as RedemptionRequestedEvent,
} from "../generated/AcreBTC/AcreBTC"
import {
  getOrCreateDepositOwner,
  getOrCreateDeposit,
  getOrCreateEvent,
  getOrCreateWithdraw,
} from "./utils"

// eslint-disable-next-line import/prefer-default-export
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

export function handleRedemptionRequested(
  event: RedemptionRequestedEvent,
): void {
  const depositOwnerEntity = getOrCreateDepositOwner(event.params.owner)

  const withdrawEntity = getOrCreateWithdraw(event.params.requestId.toString())
  withdrawEntity.depositOwner = depositOwnerEntity.id
  withdrawEntity.shares = event.params.shares

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedemptionRequested`,
  )

  redemptionRequestedEvent.activity = withdrawEntity.id
  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.type = "Requested"

  depositOwnerEntity.save()
  withdrawEntity.save()
  redemptionRequestedEvent.save()
}
