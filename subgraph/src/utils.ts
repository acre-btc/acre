import { Address, ByteArray, ethereum, Bytes } from "@graphprotocol/graph-ts"
import {
  DepositOwner,
  Deposit,
  Event,
  Withdraw,
  RedemptionKeyToPendingWithdrawal,
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

export function getLogByEventSignatureInLogs(
  logs: ethereum.Log[],
  eventSignature: ByteArray,
  contractAddress: Address,
): ethereum.Log | null {
  let logIndex = -1
  for (let i = 0; i < logs.length; i += 1) {
    const receiptLog = logs[i]

    if (
      receiptLog.address.equals(contractAddress) &&
      receiptLog.topics[0].equals(eventSignature)
    ) {
      logIndex = i
    }
  }

  if (logIndex < 0) {
    return null
  }

  return logs[logIndex]
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
