import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as/assembly/defaults"
import { Deposit } from "../generated/AcreBTC/AcreBTC"

let mockEventCounter = 0

// eslint-disable-next-line import/prefer-default-export
export function createDepositEvent(
  sender: Address,
  owner: Address,
  assets: BigInt,
  shares: BigInt,
): Deposit {
  const depositEvent = changetype<Deposit>(newMockEvent())
  mockEventCounter += 1

  depositEvent.parameters = []
  depositEvent.transaction.hash = Bytes.fromHexString(
    `0x${mockEventCounter.toString(16).padStart(64, "0")}`,
  )

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
