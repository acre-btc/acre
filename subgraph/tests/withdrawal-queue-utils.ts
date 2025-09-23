import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  newMockEvent,
  newMockCallWithIO,
} from "matchstick-as/assembly/defaults"
import {
  RedeemAndBridgeRequested,
  RequestRedeemAndBridgeCall,
} from "../generated/WithdrawalQueue/WithdrawalQueue"

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

export function createRequestRedeemAndBridgeCall(
  withdrawId: BigInt,
  redeemer: Address,
  redeemerOutputScript: Bytes,
): RequestRedeemAndBridgeCall {
  const shares = BigInt.fromI32(123)
  const exitFee = BigInt.fromI32(456)
  return changetype<RequestRedeemAndBridgeCall>(
    newMockCallWithIO(
      [
        new ethereum.EventParam(
          "_shares",
          ethereum.Value.fromUnsignedBigInt(shares),
        ),
        new ethereum.EventParam(
          "_redeemer",
          ethereum.Value.fromAddress(redeemer),
        ),
        new ethereum.EventParam(
          "_redeemerOutputScript",
          ethereum.Value.fromBytes(redeemerOutputScript),
        ),
        new ethereum.EventParam(
          "_exitFeeInTbtc",
          ethereum.Value.fromUnsignedBigInt(exitFee),
        ),
      ],
      [
        new ethereum.EventParam(
          "requestId",
          ethereum.Value.fromUnsignedBigInt(withdrawId),
        ),
      ],
    ),
  )
}
