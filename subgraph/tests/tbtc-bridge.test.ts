import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
  dataSourceMock,
} from "matchstick-as/assembly/index"

import { DataSourceContext, Bytes, BigInt } from "@graphprotocol/graph-ts"
import { createRedemptionRequestedEvent } from "./tbtc-bridge-utils"
import { handleRedemptionRequested } from "../src/tbtc-bridge"

// Set up context
const context = new DataSourceContext()
context.setBytes(
  "withdrawalQueueContractAddress",
  Bytes.fromHexString("0xa7049b83dB603f4a7FE93B29D2DfEa76065e76E8"),
)

dataSourceMock.setReturnValues(
  "0x2F86FE8C5683372Db667E6f6d88dcB6d55a81286",
  "sepolia",
  context,
)

const redemptionRequestedEventData = createRedemptionRequestedEvent(
  BigInt.fromString("123"),
)

const owner = redemptionRequestedEventData.acreOwner
const amount = redemptionRequestedEventData.tbtcAmount

describe("handleRedemptionRequested", () => {
  describe("when there is only one withdraw with the same redemption key", () => {
    beforeAll(() => {
      handleRedemptionRequested(redemptionRequestedEventData.event)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create DepositOwner entity", () => {
      assert.entityCount(
        "DepositOwner",
        1,
        "Invalid `DepositOwner` entity count",
      )
    })

    test("should create RedemptionKeyToPendingWithdrawal entity", () => {
      assert.fieldEquals(
        "RedemptionKeyToPendingWithdrawal",
        redemptionRequestedEventData.redemptionKey,
        "withdrawId",
        redemptionRequestedEventData.withdrawId.toString(),
      )
    })

    test("should create Withdraw entity", () => {
      assert.entityCount("Withdraw", 1, "Invalid `Withdraw` entity count")
    })

    test("should create Event entity", () => {
      assert.entityCount("Event", 1, "Invalid `Event` entity count")
    })

    test("should save Withdraw entity with correct fields", () => {
      const withdrawEntityId =
        redemptionRequestedEventData.withdrawId.toString()

      assert.fieldEquals(
        "Withdraw",
        withdrawEntityId,
        "depositOwner",
        owner.toHexString(),
        `Withdraw entity with id (${withdrawEntityId}) does not exist or has incorrect depositOwner value`,
      )

      assert.fieldEquals(
        "Withdraw",
        withdrawEntityId,
        "amount",
        amount.toString(),
        `Withdraw entity with id (${withdrawEntityId}) does not exist or has incorrect amount value`,
      )
    })

    test("should set correct fields for the Event entity", () => {
      const eventId = `${redemptionRequestedEventData.event.transaction.hash.toHexString()}_RedemptionRequested`

      assert.fieldEquals(
        "Event",
        eventId,
        "activity",
        redemptionRequestedEventData.withdrawId.toString(),
      )

      assert.fieldEquals(
        "Event",
        eventId,
        "timestamp",
        redemptionRequestedEventData.event.block.timestamp.toString(),
      )

      assert.fieldEquals("Event", eventId, "type", "Initialized")
    })
  })
})
