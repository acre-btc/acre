import {
  Address,
  ByteArray,
  ethereum,
  Bytes,
  BigInt,
  log as logger,
} from "@graphprotocol/graph-ts"
import {
  DepositOwner,
  Deposit,
  Event,
  Withdraw,
  RedemptionKeyToPendingWithdrawal,
  MidasWithdrawRequest,
} from "../generated/schema"

export function getOrCreateDepositOwner(depositOwnerId: Address): DepositOwner {
  const depositOwnerHexString = depositOwnerId.toHexString()
  let depositOwner = DepositOwner.load(depositOwnerHexString)

  if (!depositOwner) {
    depositOwner = new DepositOwner(depositOwnerHexString)
  }

  return depositOwner
}

export function getOrCreateDeposit(depositKey: string): Deposit {
  let deposit = Deposit.load(depositKey)

  if (!deposit) {
    deposit = new Deposit(depositKey)
  }

  return deposit
}

export function getOrCreateEvent(eventId: string): Event {
  let event = Event.load(eventId)

  if (!event) {
    event = new Event(eventId)
  }

  return event
}

export function getOrCreateRedemptionKeyToPendingWithdrawal(
  redemptionKey: string,
): RedemptionKeyToPendingWithdrawal {
  let redemptionKeyToPendingWithdrawal =
    RedemptionKeyToPendingWithdrawal.load(redemptionKey)

  if (!redemptionKeyToPendingWithdrawal) {
    redemptionKeyToPendingWithdrawal = new RedemptionKeyToPendingWithdrawal(
      redemptionKey,
    )
  }

  return redemptionKeyToPendingWithdrawal
}

export function getOrCreateWithdraw(id: string): Withdraw {
  let withdraw = Withdraw.load(id)
  if (!withdraw) {
    withdraw = new Withdraw(id)
    withdraw.depositOwner = Address.zero().toHexString()
  }

  return withdraw
}

export function getOrCreateMidasWithdrawRequest(
  id: string,
): MidasWithdrawRequest {
  let midasWithdrawRequest = MidasWithdrawRequest.load(id)
  if (!midasWithdrawRequest) {
    midasWithdrawRequest = new MidasWithdrawRequest(id)
  }

  return midasWithdrawRequest
}

export function getLogByEventSignatureInLogs(
  logs: ethereum.Log[],
  eventSignature: ByteArray,
  contractAddress: Address,
): ethereum.Log | null {
  for (let i = 0; i < logs.length; i += 1) {
    const receiptLog = logs[i]

    if (
      receiptLog.address.equals(contractAddress) &&
      receiptLog.topics.length > 0 &&
      receiptLog.topics[0].equals(eventSignature)
    ) {
      return receiptLog
    }
  }

  return null
}

export function findLogByEventSignatureInLogs(
  logs: ethereum.Log[],
  eventSignature: ByteArray,
  contractAddress: Address,
): ethereum.Log {
  const log = getLogByEventSignatureInLogs(
    logs,
    eventSignature,
    contractAddress,
  )

  if (!log) {
    const contractAddresses: string = logs
      .map<string>((l: ethereum.Log) => l.address.toHexString())
      .join(";")

    const topics: string = logs
      .map<string>((l: ethereum.Log) =>
        l.topics.map<string>((t: Bytes) => t.toHexString()).join(";"),
      )
      .join(";")

    logger.error(
      "Cannot find event (signature : {}, contract address : {}) in transaction logs with topics: [{}] and contract addresses: [{}]",
      [
        eventSignature.toHexString(),
        contractAddress.toHexString(),
        topics,
        contractAddresses,
      ],
    )

    throw new Error(
      `Cannot find event (signature: ${eventSignature.toHexString()}) in transaction logs`,
    )
  }

  return log
}

// Ref: https://github.com/suntzu93/threshold-tBTC/blob/master/src/utils/utils.ts#L54C1-L60C2
export function bytesToUint8Array(bytes: Bytes): Uint8Array {
  const uint8Array = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    uint8Array[i] = bytes[i]
  }
  return uint8Array
}

export function bigIntTo64HexString(bigint: BigInt): string {
  const hex = bigint.toHexString().slice(2) // remove '0x'
  const padded = hex.padStart(64, "0") // pad to 64 characters

  return `0x${padded}`
}
