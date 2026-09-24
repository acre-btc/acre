import {
  ethereum,
  BigInt,
  Address,
  Bytes,
  ByteArray,
  crypto,
  Wrapped,
} from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as/assembly/defaults"
import { RedemptionRequested } from "../generated/BitcoinRedeemerV3/BitcoinRedeemerV3"
import { bigIntTo64HexString } from "../src/utils"

export function createRedemptionRequestedEvent(
  owner: Address,
  shares: BigInt,
  tbtcAmount: BigInt,
  transactionHash: Bytes,
  logIndex: BigInt,
): RedemptionRequested {
  const event = changetype<RedemptionRequested>(newMockEvent())

  event.parameters = []
  event.transaction.hash = transactionHash
  event.logIndex = logIndex

  event.parameters.push(
    new ethereum.EventParam("owner", ethereum.Value.fromAddress(owner)),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares),
    ),
  )
  event.parameters.push(
    new ethereum.EventParam(
      "tbtcAmount",
      ethereum.Value.fromUnsignedBigInt(tbtcAmount),
    ),
  )

  return event
}

// `RedemptionRequested(address,uint256,uint256)` - shared verbatim with
// `BitcoinRedeemerV2`, which is exactly why the emitter address matters.
export function buildRedemptionRequestedLog(
  emitter: Address,
  owner: Address,
  shares: BigInt,
  tbtcAmount: BigInt,
  transactionHash: Bytes,
  logIndex: BigInt,
): ethereum.Log {
  return new ethereum.Log(
    emitter,
    [
      Bytes.fromByteArray(
        crypto.keccak256(
          ByteArray.fromUTF8("RedemptionRequested(address,uint256,uint256)"),
        ),
      ),
      Bytes.fromHexString(
        `0x000000000000000000000000${owner.toHexString().slice(2)}`,
      ),
    ],
    Bytes.fromHexString(
      bigIntTo64HexString(shares).concat(
        bigIntTo64HexString(tbtcAmount).slice(2),
      ),
    ),
    Bytes.fromI32(1),
    Bytes.fromI32(1),
    transactionHash,
    BigInt.fromI32(0),
    logIndex,
    BigInt.fromI32(0),
    "log",
    new Wrapped(false),
  )
}
