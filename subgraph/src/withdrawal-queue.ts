import { log } from "@graphprotocol/graph-ts"
import { Withdraw } from "../generated/schema"
import {
  RedeemRequested,
  RedeemAndBridgeRequested,
  RequestRedeemAndBridgeCall,
} from "../generated/WithdrawalQueue/WithdrawalQueue"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateMidasWithdrawRequest,
  getOrCreateWithdraw,
} from "./utils"

// This event is emitted in the same transaction as the `RedemptionRequested`
// event from the `BitcoinRedeemerV2` contract.
// eslint-disable-next-line import/prefer-default-export
export function handleRedeemAndBridgeRequested(
  event: RedeemAndBridgeRequested,
): void {
  const ownerEntity = getOrCreateDepositOwner(event.params.redeemer)

  const withdrawEntity = getOrCreateWithdraw(event.params.requestId.toString())

  withdrawEntity.depositOwner = ownerEntity.id
  withdrawEntity.requestedAmount = event.params.tbtcAmount.plus(
    event.params.exitFeeInTbtc,
  )
  withdrawEntity.amountToRedeem = event.params.tbtcAmount

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedeemAndBridgeRequested`,
  )

  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.activity = withdrawEntity.id
  redemptionRequestedEvent.type = "Requested"

  const midasWithdrawRequestEntity = getOrCreateMidasWithdrawRequest(
    event.params.midasRequestId.toString(),
  )
  midasWithdrawRequestEntity.withdraw = withdrawEntity.id

  ownerEntity.save()
  withdrawEntity.save()
  redemptionRequestedEvent.save()
  midasWithdrawRequestEntity.save()
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
  // eslint-disable-next-line no-underscore-dangle
  withdrawEntity.shares = call.inputs._shares

  withdrawEntity.save()
}

export function handleRedeemRequested(event: RedeemRequested): void {
  const withdrawEntity = getOrCreateWithdraw(event.params.requestId.toString())

  withdrawEntity.receiver = event.params.receiver.toHexString()
  withdrawEntity.amount = event.params.tbtcAmount

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedeemRequested`,
  )

  redemptionRequestedEvent.activity = withdrawEntity.id
  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.type = "Requested"

  const midasWithdrawRequestEntity = getOrCreateMidasWithdrawRequest(
    event.params.midasRequestId.toString(),
  )
  midasWithdrawRequestEntity.withdraw = withdrawEntity.id

  withdrawEntity.save()
  redemptionRequestedEvent.save()
  midasWithdrawRequestEntity.save()
}
