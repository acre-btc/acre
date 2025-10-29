import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  dataSourceMock,
} from "matchstick-as/assembly/index"

import {
  BigInt,
  Address,
  DataSourceContext,
  Bytes,
} from "@graphprotocol/graph-ts"
import { createDepositEvent } from "./acrebtc-utils"
import { handleDeposit } from "../src/acrebtc"

// Shared
const stbtcContractAddress = Address.fromString(
  "0x7e184179b1F95A9ca398E6a16127f06b81Cb37a3",
)
const depositOwner = Address.fromString(
  "0x0000000000000000000000000000000000000001",
)
const otherSender = Address.fromString(
  "0x0000000000000000000000000000000000000002",
)
const assets = BigInt.fromI32(1000)
const shares = BigInt.fromI32(900)

// Migration deposit (sender is stBTC contract)
const migrationDepositEvent = createDepositEvent(
  stbtcContractAddress,
  depositOwner,
  assets,
  shares,
)

// Regular deposit (sender is not stBTC contract)
const regularDepositEvent = createDepositEvent(
  otherSender,
  depositOwner,
  assets,
  shares,
)

// Second migration deposit
const secondDepositOwner = Address.fromString(
  "0x0000000000000000000000000000000000000003",
)
const secondAssets = BigInt.fromI32(2000)
const secondShares = BigInt.fromI32(1800)
const secondMigrationDepositEvent = createDepositEvent(
  stbtcContractAddress,
  secondDepositOwner,
  secondAssets,
  secondShares,
)

// Set up context
const context = new DataSourceContext()
context.setBytes(
  "stbtcContractAddress",
  Bytes.fromHexString(stbtcContractAddress.toHexString()),
)

dataSourceMock.setReturnValues(
  "0xB8ba4B007321e0EB4586De49E59593E0eD66d367",
  "sepolia",
  context,
)

describe("handleDeposit", () => {
  describe("when the deposit is from stBTC contract (migration)", () => {
    beforeAll(() => {
      handleDeposit(migrationDepositEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create DepositOwner entity", () => {
      assert.entityCount("DepositOwner", 1)
    })

    test("should create Deposit entity", () => {
      assert.entityCount("Deposit", 1)
    })

    test("should create Event entity", () => {
      assert.entityCount("Event", 1)
    })

    test("Deposit entity has proper fields", () => {
      const depositEntityId = `${migrationDepositEvent.transaction.hash.toHexString()}_${migrationDepositEvent.logIndex.toString()}`

      assert.fieldEquals(
        "Deposit",
        depositEntityId,
        "depositOwner",
        depositOwner.toHexString(),
      )

      assert.fieldEquals(
        "Deposit",
        depositEntityId,
        "initialDepositAmount",
        assets.toString(),
      )

      assert.fieldEquals(
        "Deposit",
        depositEntityId,
        "amountToDeposit",
        assets.toString(),
      )
    })

    test("Event entity has proper fields", () => {
      const eventId = `${migrationDepositEvent.transaction.hash.toHexString()}_${migrationDepositEvent.logIndex.toString()}_StBtcToAcreBtcDeposit`

      assert.fieldEquals(
        "Event",
        eventId,
        "activity",
        `${migrationDepositEvent.transaction.hash.toHexString()}_${migrationDepositEvent.logIndex.toString()}`,
      )

      assert.fieldEquals(
        "Event",
        eventId,
        "timestamp",
        migrationDepositEvent.block.timestamp.toString(),
      )

      assert.fieldEquals("Event", eventId, "type", "Migrated")
    })
  })

  describe("when the deposit is not from stBTC contract", () => {
    beforeAll(() => {
      handleDeposit(regularDepositEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should NOT create DepositOwner entity", () => {
      assert.entityCount("DepositOwner", 0)
    })

    test("should NOT create Deposit entity", () => {
      assert.entityCount("Deposit", 0)
    })

    test("should NOT create Event entity", () => {
      assert.entityCount("Event", 0)
    })
  })

  describe("when the deposit owner already exists (multiple migrations)", () => {
    beforeAll(() => {
      handleDeposit(migrationDepositEvent)
      handleDeposit(secondMigrationDepositEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create two DepositOwner entities", () => {
      assert.entityCount("DepositOwner", 2)
    })

    test("should create two Deposit entities", () => {
      assert.entityCount("Deposit", 2)
    })

    test("should create two Event entities", () => {
      assert.entityCount("Event", 2)
    })

    test("second Deposit entity has proper fields", () => {
      const secondDepositEntityId = `${secondMigrationDepositEvent.transaction.hash.toHexString()}_${secondMigrationDepositEvent.logIndex.toString()}`

      assert.fieldEquals(
        "Deposit",
        secondDepositEntityId,
        "depositOwner",
        secondDepositOwner.toHexString(),
      )

      assert.fieldEquals(
        "Deposit",
        secondDepositEntityId,
        "initialDepositAmount",
        secondAssets.toString(),
      )

      assert.fieldEquals(
        "Deposit",
        secondDepositEntityId,
        "amountToDeposit",
        secondAssets.toString(),
      )
    })

    test("second Event entity has proper fields", () => {
      const secondEventId = `${secondMigrationDepositEvent.transaction.hash.toHexString()}_${secondMigrationDepositEvent.logIndex.toString()}_StBtcToAcreBtcDeposit`

      assert.fieldEquals(
        "Event",
        secondEventId,
        "activity",
        `${secondMigrationDepositEvent.transaction.hash.toHexString()}_${secondMigrationDepositEvent.logIndex.toString()}`,
      )

      assert.fieldEquals(
        "Event",
        secondEventId,
        "timestamp",
        secondMigrationDepositEvent.block.timestamp.toString(),
      )

      assert.fieldEquals("Event", secondEventId, "type", "Migrated")
    })
  })

  describe("when mixing regular and migration deposits", () => {
    beforeAll(() => {
      handleDeposit(regularDepositEvent)
      handleDeposit(migrationDepositEvent)
      handleDeposit(regularDepositEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should only create entities for the migration deposit", () => {
      assert.entityCount("DepositOwner", 1)
      assert.entityCount("Deposit", 1)
      assert.entityCount("Event", 1)
    })
  })
})
