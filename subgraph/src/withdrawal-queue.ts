import { RedeemAndBridgeRequested } from "../generated/WithdrawalQueue/WithdrawalQueue"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateWithdraw,
} from "./utils"

// This event is emitted in the same transaction as the `RedemptionRequested`
// event from the `BitcoinRedeemerV2` contract.
// eslint-disable-next-line import/prefer-default-export
export function handleRedeemAndBridgeRequested(
  event: RedeemAndBridgeRequested,
): void {
  const ownerEntity = getOrCreateDepositOwner(event.params.redeemer)

  const withdraw = getOrCreateWithdraw(event.params.requestId.toString())

  withdraw.depositOwner = ownerEntity.id
  withdraw.requestedAmount = event.params.tbtcAmount.plus(
    event.params.exitFeeInTbtc,
  )

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
