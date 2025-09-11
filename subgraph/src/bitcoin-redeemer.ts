import { RedemptionRequested } from "../generated/BitcoinRedeemer/BitcoinRedeemer"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateWithdraw,
} from "./utils"

// eslint-disable-next-line import/prefer-default-export
export function handleRedemptionRequested(event: RedemptionRequested): void {
  const ownerEntity = getOrCreateDepositOwner(event.params.owner)

  const withdraw = getOrCreateWithdraw(event.params.requestId.toString())

  withdraw.depositOwner = ownerEntity.id

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedemptionRequested`,
  )

  redemptionRequestedEvent.activity = withdraw.id
  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.type = "Initialized"

  ownerEntity.save()
  withdraw.save()
  redemptionRequestedEvent.save()
}
