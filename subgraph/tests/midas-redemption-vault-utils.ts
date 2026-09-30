import { ethereum, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as/assembly/defaults"
import { SafeApproveRequest } from "../generated/MidasRedemptionVault/MidasRedemptionVault"

// eslint-disable-next-line import/prefer-default-export
export function createSafeApproveRequestEvent(
  requestId: BigInt,
  newOutRate: BigInt,
  transactionHash: Bytes,
): SafeApproveRequest {
  const event = changetype<SafeApproveRequest>(newMockEvent())

  event.parameters = []
  event.transaction.hash = transactionHash

  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "newOutRate",
      ethereum.Value.fromUnsignedBigInt(newOutRate),
    ),
  )

  return event
}
