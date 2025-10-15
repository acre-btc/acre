import {
  Address,
  dataSource,
  ethereum,
  crypto,
  ByteArray,
  BigInt,
} from "@graphprotocol/graph-ts"
import { getLogByEventSignatureInLogs } from "./utils"

const REDEEM_COMPLETED_AND_BRIDGE_REQUESTED = crypto.keccak256(
  ByteArray.fromUTF8(
    "RedeemCompletedAndBridgeRequested(uint256,address,uint256)",
  ),
)

export function getRedeemCompletedAndBridgedRequestedLog(
  logs: ethereum.Log[],
): ethereum.Log | null {
  const withdrawalQueueContractAddress = Address.fromBytes(
    dataSource.context().getBytes("withdrawalQueueContractAddress"),
  )

  return getLogByEventSignatureInLogs(
    logs,
    REDEEM_COMPLETED_AND_BRIDGE_REQUESTED,
    withdrawalQueueContractAddress,
  )
}

export function getOwnerFromRedeemCompletedAndBridgedRequestedLog(
  log: ethereum.Log,
): Address {
  // The owner (redeemer) address is second indexed param.
  return ethereum.decode("address", log.topics[2])!.toAddress()
}

export function getRequestIdFromRedeemCompletedAndBridgedRequestedLog(
  log: ethereum.Log,
): BigInt {
  // The `requestId` is first indexed param.
  return ethereum.decode("uint256", log.topics[1])!.toBigInt()
}

export function getTbtcFromRedeemCompletedAndBridgedRequestedLog(
  log: ethereum.Log,
): BigInt {
  const decoded = ethereum.decode("(uint256)", log.data)!.toTuple()

  return decoded[0].toBigInt()
}
