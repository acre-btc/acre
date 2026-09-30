import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as/assembly/defaults"
import {
  Deposit,
  RedemptionRequested,
  Withdraw,
} from "../generated/AcreBTC/AcreBTC"

let mockEventCounter = 0

function nextTransactionHash(): Bytes {
  mockEventCounter += 1
  return Bytes.fromHexString(
    `0x${mockEventCounter.toString(16).padStart(64, "0")}`,
  )
}

export function createDepositEvent(
  sender: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
): Deposit {
  const depositEvent = changetype<Deposit>(newMockEvent())

  depositEvent.parameters = []
  depositEvent.transaction.hash = nextTransactionHash()

  const senderParam = new ethereum.EventParam(
    "sender",
    ethereum.Value.fromAddress(sender),
  )

  const ownerParam = new ethereum.EventParam(
    "owner",
    ethereum.Value.fromAddress(owner),
  )

  const assetsParam = new ethereum.EventParam(
    "assets",
    ethereum.Value.fromUnsignedBigInt(assets),
  )

  const sharesParam = new ethereum.EventParam(
    "shares",
    ethereum.Value.fromUnsignedBigInt(shares),
  )

  depositEvent.parameters.push(senderParam)
  depositEvent.parameters.push(ownerParam)
  depositEvent.parameters.push(assetsParam)
  depositEvent.parameters.push(sharesParam)

  return depositEvent
}

export function createRedemptionRequestedEvent(
  requestId: BigInt,
  owner: Address,
  receiver: Address,
  caller: Address,
  shares: BigInt,
): RedemptionRequested {
  const event = changetype<RedemptionRequested>(newMockEvent())

  event.parameters = []
  event.transaction.hash = nextTransactionHash()

  event.parameters.push(
    new ethereum.EventParam(
      "requestId",
      ethereum.Value.fromUnsignedBigInt(requestId),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  )
  event.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)),
  )
  event.parameters.push(
    new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares),
    ),
  )

  return event
}

export function createWithdrawEvent(
  sender: Address,
  receiver: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
): Withdraw {
  const event = changetype<Withdraw>(newMockEvent())

  event.parameters = []
  event.transaction.hash = nextTransactionHash()

  event.parameters.push(
    new ethereum.EventParam("sender", ethereum.Value.fromAddress(sender)),
  )
  event.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver)),
  )
  event.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(assets),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares),
    ),
  )

  return event
}
