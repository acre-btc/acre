import { Address, dataSource } from "@graphprotocol/graph-ts"
import { Deposit as DepositEvent } from "../generated/AcreBTC/AcreBTC"
import {
  getOrCreateDepositOwner,
  getOrCreateDeposit,
  getOrCreateEvent,
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
