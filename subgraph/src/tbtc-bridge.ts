import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts"
import {
  getOrCreateDepositOwner,
  getOrCreateEvent,
  getOrCreateWithdraw,
  bytesToUint8Array,
  getOrCreateRedemptionKeyToPendingWithdrawal,
} from "./utils"
import {
  RedemptionRequested,
  RedemptionsCompleted,
  SubmitRedemptionProofCall,
} from "../generated/TbtcBridge/TbtcBridge"
import {
  buildRedemptionKey,
  toBitcoinTxId,
  buildRedemptionKeyFromRedeemerOutputScript,
} from "./tbtc-utils"
import {
  getOwnerFromRedeemCompletedAndBridgedRequestedLog,
  getRedeemCompletedAndBridgedRequestedLog,
  getTbtcFromRedeemCompletedAndBridgedRequestedLog,
  getRequestIdFromRedeemCompletedAndBridgedRequestedLog,
} from "./withdrawal-queue-utils"
import {
  buildBitcoinRedeemerV3WithdrawId,
  getBitcoinRedeemerV3RedemptionRequestedLog,
  getOwnerFromBitcoinRedeemerV3Log,
  getTbtcAmountFromBitcoinRedeemerV3Log,
} from "./bitcoin-redeemer-v3-utils"
import * as BitcoinUtils from "./bitcoin-utils"
import { RedemptionsCompletedEvent } from "../generated/schema"

export function handleRedemptionRequested(event: RedemptionRequested): void {
  // eslint-disable-next-line prefer-destructuring
  const logs = (event.receipt as ethereum.TransactionReceipt).logs

  // The tBTC Bridge redeems for everyone, so a redemption is only Acre's if the
  // transaction also carries a log from one of our redemption paths. There are
  // two, and they cannot both be present:
  //
  //  - the Midas `WithdrawalQueue` completing a queued request, where the
  //    withdrawal was already created at request time and is keyed by the
  //    queue's request id, and
  //  - `BitcoinRedeemerV3`, which is not queued, so the redemption is
  //    requested and handed to the Bridge in this same transaction.
  let ownerId: Address
  let withdrawId: string
  let amount: BigInt

  const redeemCompletedAndBridgeRequestedLog =
    getRedeemCompletedAndBridgedRequestedLog(logs)

  if (redeemCompletedAndBridgeRequestedLog) {
    ownerId = getOwnerFromRedeemCompletedAndBridgedRequestedLog(
      redeemCompletedAndBridgeRequestedLog,
    )
    withdrawId = getRequestIdFromRedeemCompletedAndBridgedRequestedLog(
      redeemCompletedAndBridgeRequestedLog,
    ).toString()
    amount = getTbtcFromRedeemCompletedAndBridgedRequestedLog(
      redeemCompletedAndBridgeRequestedLog,
    )
  } else {
    const bitcoinRedeemerV3Log =
      getBitcoinRedeemerV3RedemptionRequestedLog(logs)

    if (!bitcoinRedeemerV3Log) {
      log.info("The redemption does not come from the Acre", [])
      return
    }

    ownerId = getOwnerFromBitcoinRedeemerV3Log(bitcoinRedeemerV3Log)
    // Must match the id `bitcoin-redeemer-v3.ts` built from the same log, so
    // this stage lands on the withdrawal that handler already created.
    withdrawId = buildBitcoinRedeemerV3WithdrawId(
      event.transaction.hash,
      bitcoinRedeemerV3Log.logIndex,
    )
    amount = getTbtcAmountFromBitcoinRedeemerV3Log(bitcoinRedeemerV3Log)
  }

  const ownerEntity = getOrCreateDepositOwner(ownerId)

  const redemptionKey = buildRedemptionKeyFromRedeemerOutputScript(
    event.params.redeemerOutputScript,
    event.params.walletPubKeyHash,
  )

  const redemptionKeyToPendingWithdrawal =
    getOrCreateRedemptionKeyToPendingWithdrawal(redemptionKey)
  redemptionKeyToPendingWithdrawal.withdrawId = withdrawId

  const withdraw = getOrCreateWithdraw(withdrawId)
  withdraw.depositOwner = ownerEntity.id
  withdraw.amount = amount

  const redemptionRequestedEvent = getOrCreateEvent(
    `${event.transaction.hash.toHexString()}_RedemptionRequested`,
  )
  redemptionRequestedEvent.activity = withdraw.id
  redemptionRequestedEvent.timestamp = event.block.timestamp
  redemptionRequestedEvent.type = "Initialized"

  ownerEntity.save()
  withdraw.save()
  redemptionRequestedEvent.save()

  redemptionKeyToPendingWithdrawal.save()
}

function buildRedemptionsCompletedEventId(
  walletPublicKeyHash: Bytes,
  ethereumTransactionHash: Bytes,
): string {
  return walletPublicKeyHash
    .toHexString()
    .concat("-")
    .concat(ethereumTransactionHash.toHexString())
}

// Based on the docs: Event and call triggers within the same transaction are
// ordered using a convention: event triggers first then call triggers, each
// type respecting the order they are defined in the manifest.
export function handleRedemptionsCompleted(event: RedemptionsCompleted): void {
  const entity = new RedemptionsCompletedEvent(
    buildRedemptionsCompletedEventId(
      event.params.walletPubKeyHash,
      event.transaction.hash,
    ),
  )

  // We need to save this event to get the bitcoin tx hash and save it in
  // `Withdraw` entity. To get the bitcoin tx hash from the
  // `submitRedemptionProof` call handler is time-consuming because the
  // `encodePacked` function and the `sha256` hash algorithm are not supported
  // in the subgraph API. We need these two functions to build the bitcoin tx
  // hash from the ethereum transaction input data . So the easiest and fastest
  // way is to save the bitcoin redemption tx hash in `RedemptionsCompleted`
  // entity and get it when processing the redemptions in
  // `handleSubmitRedemptionProofCall`.
  entity.redemptionTxHash = event.params.redemptionTxHash

  entity.save()
}

function getBitcoinRedemptionTxId(
  walletPubKeyHash: Bytes,
  ethereumTxHash: Bytes,
): string {
  const redemptionsCompletedEvent = RedemptionsCompletedEvent.load(
    buildRedemptionsCompletedEventId(walletPubKeyHash, ethereumTxHash),
  )

  if (!redemptionsCompletedEvent) {
    log.warning("Cannot find the Bitcoin redemption tx hash...", [])
    return "0x0"
  }

  return toBitcoinTxId(redemptionsCompletedEvent.redemptionTxHash.toHexString())
}

export function handleSubmitRedemptionProofCall(
  call: SubmitRedemptionProofCall,
): void {
  // eslint-disable-next-line prefer-destructuring
  const outputVector = call.inputs.redemptionTx.outputVector
  const bitcoinTransactionOutputVector = BitcoinUtils.parseVarInt(
    bytesToUint8Array(outputVector),
  )
  const outputsCompactSizeUintLength = bitcoinTransactionOutputVector.dataLength
  const outputsCount = bitcoinTransactionOutputVector.number.toI32()

  // To determine the first output starting index, we must jump over the
  // compactSize uint which prepends the output vector. One byte must be added
  // because `BtcUtils.parseVarInt` does not include compactSize uint tag in the
  // returned length.
  //
  // For >= 0 && <= 252, `BTCUtils.determineVarIntDataLengthAt` returns `0`, so
  // we jump over one byte of compactSize uint.
  //
  // For >= 253 && <= 0xffff there is `0xfd` tag,
  // `BTCUtils.determineVarIntDataLengthAt` returns `2` (no tag byte included)
  // so we need to jump over 1+2 bytes of compactSize uint.
  let outputStartingIndex = outputsCompactSizeUintLength.plus(BigInt.fromI32(1))

  for (let i: i32 = 0; i < outputsCount; i += 1) {
    const outputLength = BitcoinUtils.determineOutputLengthAt(
      outputVector,
      outputStartingIndex,
    )

    // The output consists of an 8-byte value and a variable length script. To
    // hash that script we slice the output starting from 9th byte until the
    // end.
    const scriptLength = outputLength.minus(BigInt.fromI32(8))
    const outputScriptStart = outputStartingIndex.plus(BigInt.fromI32(8))

    const outputScriptHash = BitcoinUtils.calculateOutputScriptHash(
      bytesToUint8Array(outputVector),
      outputScriptStart.toI32(),
      scriptLength.toI32(),
    )

    // TODO: Something is wrong here. We probably build the redemption key in
    // wrong way so we can't find the `Withdraw` entity and update.
    const redemptionKey = buildRedemptionKey(
      Bytes.fromByteArray(outputScriptHash),
      call.inputs.walletPubKeyHash,
    )

    const redemptionKeyToPendingWithdrawal =
      getOrCreateRedemptionKeyToPendingWithdrawal(redemptionKey)

    // Check if the withdraw entity exists. Only withdrawals from Acre exist in
    // the subgraph and they should be already indexed and the `depositOwner`
    // should be set correctly. Otherwise, it means the withdrawal does not come
    // from the Acre network. The tBTC network redeems in a batch so there may
    // be other redemptions not only from the Acre.
    if (redemptionKeyToPendingWithdrawal.withdrawId != null) {
      const withdraw = getOrCreateWithdraw(
        // We must use non-null assertion here otherwise AssemblyScript will
        // fail.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        redemptionKeyToPendingWithdrawal.withdrawId!,
      )

      const bitcoinTransactionId = getBitcoinRedemptionTxId(
        call.inputs.walletPubKeyHash,
        call.transaction.hash,
      )
      withdraw.bitcoinTransactionId = bitcoinTransactionId

      const redemptionCompletedEvent = getOrCreateEvent(
        `${call.transaction.hash.toHexString()}_${withdraw.id.toString()}_RedemptionCompleted`,
      )

      redemptionCompletedEvent.activity = withdraw.id
      redemptionCompletedEvent.timestamp = call.block.timestamp
      redemptionCompletedEvent.type = "Finalized"

      // Redemption completed. There are no pending withdrawals with the same
      // redemption key. Meaning that a redemption with the same redemption key
      // can be created.
      redemptionKeyToPendingWithdrawal.withdrawId = null

      redemptionCompletedEvent.save()
      withdraw.save()
      redemptionKeyToPendingWithdrawal.save()
    }

    outputStartingIndex = outputStartingIndex.plus(outputLength)
  }
}
