import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as/assembly/defaults"
import { RedeemAndBridgeRequested } from "../generated/WithdrawalQueue/WithdrawalQueue"

// eslint-disable-next-line import/prefer-default-export
export function createRedeemAndBridgeRequestedEvent(
  requestId: BigInt,
  owner: Address,
  midasRequestId: BigInt,
  tbtcAmount: BigInt,
  exitFeeInTbtc: BigInt,
  midasSharesWithFee: BigInt,
): RedeemAndBridgeRequested {
  const redeemAndBridgeRequestedEvent =
    changetype<RedeemAndBridgeRequested>(newMockEvent())

  redeemAndBridgeRequestedEvent.parameters = []

  const withdrawalRequestId = new ethereum.EventParam(
    "requestId",
    ethereum.Value.fromUnsignedBigInt(requestId),
  )
  const redeemer = new ethereum.EventParam(
    "redeemer",
    ethereum.Value.fromAddress(owner),
  )

  const midasRequestIdParam = new ethereum.EventParam(
    "midasRequestId",
    ethereum.Value.fromUnsignedBigInt(midasRequestId),
  )

  const tbtcAmountParam = new ethereum.EventParam(
    "tbtcAmount",
    ethereum.Value.fromUnsignedBigInt(tbtcAmount),
  )

  const exitFee = new ethereum.EventParam(
    "exitFeeInTbtc",
    ethereum.Value.fromUnsignedBigInt(exitFeeInTbtc),
  )

  const midasShares = new ethereum.EventParam(
    "midasSharesWithFee",
    ethereum.Value.fromUnsignedBigInt(midasSharesWithFee),
  )

  redeemAndBridgeRequestedEvent.parameters.push(withdrawalRequestId)
  redeemAndBridgeRequestedEvent.parameters.push(redeemer)
  redeemAndBridgeRequestedEvent.parameters.push(midasRequestIdParam)
  redeemAndBridgeRequestedEvent.parameters.push(tbtcAmountParam)
  redeemAndBridgeRequestedEvent.parameters.push(exitFee)
  redeemAndBridgeRequestedEvent.parameters.push(midasShares)

  return redeemAndBridgeRequestedEvent
}
