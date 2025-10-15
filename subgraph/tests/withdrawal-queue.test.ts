import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll,
} from "matchstick-as/assembly/index"
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  createRedeemAndBridgeRequestedEvent,
  createRequestRedeemAndBridgeCall,
} from "./withdrawal-queue-utils"
import {
  handleRedeemAndBridgeRequested,
  handleRequestRedeemAndBridgeCall,
} from "../src/withdrawal-queue"
import { DepositOwner } from "../generated/schema"

// Shared
const owner = Address.fromString("0x0000000000000000000000000000000000000001")
const tbtcAmount = BigInt.fromI32(234)
const exitFeeInTbtc = BigInt.fromI32(234)
const midasSharesWithFee = BigInt.fromI32(234)

// First withdrawal
const requestId = BigInt.fromI32(555)
const midasRequestId = BigInt.fromI32(234)
const redeemAndBridgeRequestedEvent = createRedeemAndBridgeRequestedEvent(
  requestId,
  owner,
  midasRequestId,
  tbtcAmount,
  exitFeeInTbtc,
  midasSharesWithFee,
)

// Second withdrawal
const secondRequestId = BigInt.fromI32(600)
const secondMidasRequestId = BigInt.fromI32(500)
const secondRedeemAndBridgeRequestedEvent = createRedeemAndBridgeRequestedEvent(
  secondRequestId,
  owner,
  secondMidasRequestId,
  tbtcAmount.plus(BigInt.fromI32(2)),
  exitFeeInTbtc.plus(BigInt.fromI32(3)),
  midasSharesWithFee,
)

const redeemerOutputScript = Bytes.fromHexString("0x12345678")
const requestRedeemAndBridgeCall = createRequestRedeemAndBridgeCall(
  requestId,
  owner,
  redeemerOutputScript,
)

describe("handleRedeemAndBridgeRequested", () => {
  describe("when the owner doesn't exist yet", () => {
    beforeAll(() => {
      handleRedeemAndBridgeRequested(redeemAndBridgeRequestedEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create DepositOwner entity", () => {
      assert.entityCount("DepositOwner", 1)
    })

    test("should create Withdraw entity", () => {
      assert.entityCount("Withdraw", 1)
    })

    test("should create Event entity", () => {
      assert.entityCount("Event", 1)
    })

    test("should set correct fields for the Withdraw entity", () => {
      const withdrawId =
        redeemAndBridgeRequestedEvent.params.requestId.toString()

      assert.fieldEquals(
        "Withdraw",
        withdrawId,
        "depositOwner",
        redeemAndBridgeRequestedEvent.params.redeemer.toHexString(),
      )

      assert.fieldEquals(
        "Withdraw",
        withdrawId,
        "requestedAmount",
        redeemAndBridgeRequestedEvent.params.tbtcAmount
          .plus(redeemAndBridgeRequestedEvent.params.exitFeeInTbtc)
          .toString(),
      )
    })

    test("should set correct fields for the Event entity", () => {
      const txId = `${redeemAndBridgeRequestedEvent.transaction.hash.toHexString()}_RedeemAndBridgeRequested`

      assert.fieldEquals(
        "Event",
        txId,
        "activity",
        redeemAndBridgeRequestedEvent.params.requestId.toString(),
      )

      assert.fieldEquals(
        "Event",
        txId,
        "timestamp",
        redeemAndBridgeRequestedEvent.block.timestamp.toString(),
      )

      assert.fieldEquals("Event", txId, "type", "Requested")
    })
  })

  describe("when the owner already exists", () => {
    beforeAll(() => {
      handleRedeemAndBridgeRequested(redeemAndBridgeRequestedEvent)
      handleRedeemAndBridgeRequested(secondRedeemAndBridgeRequestedEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("the DepositOwner entity should already exists", () => {
      const existingDepositOwner = DepositOwner.load(
        secondRedeemAndBridgeRequestedEvent.params.redeemer.toHexString(),
      )

      assert.assertNotNull(existingDepositOwner)
      assert.entityCount("DepositOwner", 1)
    })

    test("should create the second Withdraw entity correctly", () => {
      const secondWithdrawId =
        secondRedeemAndBridgeRequestedEvent.params.requestId.toString()

      assert.fieldEquals(
        "Withdraw",
        secondWithdrawId,
        "depositOwner",
        owner.toHexString(),
      )

      assert.fieldEquals(
        "Withdraw",
        secondWithdrawId,
        "requestedAmount",
        secondRedeemAndBridgeRequestedEvent.params.tbtcAmount
          .plus(secondRedeemAndBridgeRequestedEvent.params.exitFeeInTbtc)
          .toString(),
      )
    })

    test("should set correct fields for the Event entity", () => {
      const secondEventId = `${secondRedeemAndBridgeRequestedEvent.transaction.hash.toHexString()}_RedeemAndBridgeRequested`

      assert.fieldEquals(
        "Event",
        secondEventId,
        "activity",
        secondRedeemAndBridgeRequestedEvent.params.requestId.toString(),
      )

      assert.fieldEquals(
        "Event",
        secondEventId,
        "timestamp",
        secondRedeemAndBridgeRequestedEvent.block.timestamp.toString(),
      )

      assert.fieldEquals("Event", secondEventId, "type", "Requested")
    })
  })
})

describe("handleRequestRedeemAndBridgeCall", () => {
  beforeAll(() => {
    handleRedeemAndBridgeRequested(redeemAndBridgeRequestedEvent)
    handleRequestRedeemAndBridgeCall(requestRedeemAndBridgeCall)
  })

  afterAll(() => {
    clearStore()
  })

  test("should set the redeemer output script for a given withdraw entity", () => {
    assert.fieldEquals(
      "Withdraw",
      requestId.toString(),
      "redeemerOutputScript",
      redeemerOutputScript.toHexString(),
    )
  })
})
