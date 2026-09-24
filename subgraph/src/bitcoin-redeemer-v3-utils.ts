import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  crypto,
  dataSource,
  ethereum,
} from "@graphprotocol/graph-ts"
import { getLogByEventSignatureInLogs } from "./utils"

// Careful: `BitcoinRedeemerV2` declares an event of the same name and the same
// canonical signature - `RedemptionRequested(address,uint256,uint256)` - so the
// two share this topic, even though V2 indexes its second parameter and V3 does
// not. Decoding a V2 log with the accessors below would read the wrong values,
// which is why every lookup here filters on the V3 address as well as the topic.
const REDEMPTION_REQUESTED = crypto.keccak256(
  ByteArray.fromUTF8("RedemptionRequested(address,uint256,uint256)"),
)

export function buildBitcoinRedeemerV3WithdrawId(
  transactionHash: Bytes,
  logIndex: BigInt,
): string {
  return `${transactionHash.toHexString()}_${logIndex.toString()}`
}

export function getBitcoinRedeemerV3RedemptionRequestedLog(
  logs: ethereum.Log[],
): ethereum.Log | null {
  const bitcoinRedeemerV3ContractAddress = Address.fromBytes(
    dataSource.context().getBytes("bitcoinRedeemerV3ContractAddress"),
  )

  // Returns the last matching log in the receipt. A transaction only ever
  // carries one redemption - no Acre or tBTC Bridge transaction on mainnet has
  // ever contained two - so there is nothing to disambiguate.
  return getLogByEventSignatureInLogs(
    logs,
    REDEMPTION_REQUESTED,
    bitcoinRedeemerV3ContractAddress,
  )
}

export function getOwnerFromBitcoinRedeemerV3Log(log: ethereum.Log): Address {
  // The owner is the only indexed param.
  return ethereum.decode("address", log.topics[1])!.toAddress()
}

export function getTbtcAmountFromBitcoinRedeemerV3Log(
  log: ethereum.Log,
): BigInt {
  // `shares` then `tbtcAmount`, both unindexed.
  const decoded = ethereum.decode("(uint256,uint256)", log.data)!.toTuple()

  return decoded[1].toBigInt()
}
