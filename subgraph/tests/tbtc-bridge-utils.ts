import {
  ethereum,
  BigInt,
  Address,
  Bytes,
  Wrapped,
  crypto,
  ByteArray,
} from "@graphprotocol/graph-ts"
import { newMockEvent } from "matchstick-as"
import { RedemptionRequested } from "../generated/TbtcBridge/TbtcBridge"
import { bigIntTo64HexString } from "../src/utils"

class RedemptionRequestedEventData {
  event: RedemptionRequested

  redemptionKey: string

  acreOwner: Address

  tbtcAmount: BigInt

  withdrawId: BigInt

  constructor(
    event: RedemptionRequested,
    key: string,
    acreOwner: Address,
    tbtcAmount: BigInt,
    withdrawId: BigInt,
  ) {
    this.event = event
    this.redemptionKey = key
    this.acreOwner = acreOwner
    this.tbtcAmount = tbtcAmount
    this.withdrawId = withdrawId
  }
}

// eslint-disable-next-line import/prefer-default-export
export function createRedemptionRequestedEvent(
  withdrawId: BigInt,
): RedemptionRequestedEventData {
  const redemptionRequestedEvent =
    changetype<RedemptionRequested>(newMockEvent())

  redemptionRequestedEvent.parameters = []

  const walletPubKeyHashParam = new ethereum.EventParam(
    "walletPubKeyHash",
    ethereum.Value.fromBytes(
      Bytes.fromHexString("0xEF5A2946F294F1742A779C9AC034BC3FA5D417B8"),
    ),
  )

  const redeemerParam = new ethereum.EventParam(
    "redeemer",
    ethereum.Value.fromAddress(
      Address.fromString("0x5476A06f08CD1F9669Ae6643C5eF9cc4F1848970"),
    ),
  )

  const redeemerOutputScriptParam = new ethereum.EventParam(
    "redeemerOutputScript",
    ethereum.Value.fromBytes(
      Bytes.fromHexString("0x1600143A40F641492A28AC72C7098A9D6AA083E5E62F66"),
    ),
  )

  const requestedAmountParam = new ethereum.EventParam(
    "requestedAmount",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1017456)),
  )

  const treasuryFeeParam = new ethereum.EventParam(
    "treasuryFee",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(508)),
  )

  const txMaxFeeParam = new ethereum.EventParam(
    "txMaxFee",
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(800000)),
  )

  const acreOwner = Address.fromString(
    "0x5476A06f08CD1F9669Ae6643C5eF9cc4F1848970",
  )
  const acreOwnerAsHex = Bytes.fromHexString(
    "0x0000000000000000000000005476a06f08cd1f9669ae6643c5ef9cc4f1848970",
  )
  const tbtcAmount = BigInt.fromString("10174563591022443")

  const redeemCompleteAndBridgeRequestedEventSignature = Bytes.fromHexString(
    crypto
      .keccak256(
        ByteArray.fromUTF8(
          "RedeemCompletedAndBridgeRequested(uint256,address,uint256)",
        ),
      )
      .toHexString(),
  )

  const withdrawIdAsHex = Bytes.fromHexString(bigIntTo64HexString(withdrawId))

  const redeemCompleteAndBridgeRequestedEventLogData = Bytes.fromHexString(
    bigIntTo64HexString(tbtcAmount),
  )

  const log = new ethereum.Log(
    Address.fromString("0xa7049b83dB603f4a7FE93B29D2DfEa76065e76E8"),
    [
      // Event signature
      redeemCompleteAndBridgeRequestedEventSignature,
      // `requestId` - indexed topic 1
      withdrawIdAsHex,
      // `redeemer` - indexed topic 2
      acreOwnerAsHex,
    ],
    redeemCompleteAndBridgeRequestedEventLogData,
    redemptionRequestedEvent.block.hash,
    Bytes.fromI32(1),
    redemptionRequestedEvent.transaction.hash,
    redemptionRequestedEvent.transaction.index,
    redemptionRequestedEvent.logIndex,
    redemptionRequestedEvent.transactionLogIndex,
    redemptionRequestedEvent.logType as string,
    new Wrapped(false),
  )

  ;(redemptionRequestedEvent.receipt as ethereum.TransactionReceipt).logs.push(
    log,
  )

  redemptionRequestedEvent.parameters.push(walletPubKeyHashParam)
  redemptionRequestedEvent.parameters.push(redeemerOutputScriptParam)
  redemptionRequestedEvent.parameters.push(redeemerParam)
  redemptionRequestedEvent.parameters.push(requestedAmountParam)
  redemptionRequestedEvent.parameters.push(treasuryFeeParam)
  redemptionRequestedEvent.parameters.push(txMaxFeeParam)

  const redemptionKey =
    "0x8256d2fe20e5faf7b973e0d3f5902b40ed5b3277b67ba0656dadfe83fb468173"

  const data = new RedemptionRequestedEventData(
    redemptionRequestedEvent,
    redemptionKey,
    acreOwner,
    tbtcAmount,
    withdrawId,
  )

  return data
}
