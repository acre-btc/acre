import {
  Address,
  ByteArray,
  ethereum,
  Bytes,
  BigInt,
} from "@graphprotocol/graph-ts"
import {
  DepositOwner,
  Deposit,
  Event,
  Withdraw,
  RedemptionKeyToPendingWithdrawal,
  MidasRequestToWithdrawal,
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
    // Bitcoin is the default so the handlers of the Bitcoin path - which are
    // spread across `withdrawal-queue.ts` and `tbtc-bridge.ts` and any of which
    // may be the one that creates the entity - do not have to set it. The tBTC
    // handlers overwrite it.
    withdraw.destination = "Bitcoin"
  }

  return withdraw
}

export function getOrCreateMidasRequestToWithdrawal(
  midasRequestId: BigInt,
  withdrawId: string,
): MidasRequestToWithdrawal {
  const id = midasRequestId.toString()
  let entity = MidasRequestToWithdrawal.load(id)

  if (!entity) {
    entity = new MidasRequestToWithdrawal(id)
  }

  entity.withdrawId = withdrawId

  return entity
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

export function bigIntTo64HexString(bigint: BigInt): string {
  const hex = bigint.toHexString().slice(2) // remove '0x'
  const padded = hex.padStart(64, "0") // pad to 64 characters

  return `0x${padded}`
}
