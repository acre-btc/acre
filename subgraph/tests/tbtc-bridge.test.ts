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
  DataSourceContext,
  Bytes,
  BigInt,
  Address,
} from "@graphprotocol/graph-ts"
import {
  attachRedemptionRequestedLogToReceipt,
  createBareRedemptionRequestedEvent,
  createRedemptionRequestedEvent,
} from "./tbtc-bridge-utils"
import {
  buildRedemptionRequestedLog,
  createRedemptionRequestedEvent as createV3RedemptionRequestedEvent,
} from "./bitcoin-redeemer-v3-utils"
import { handleRedemptionRequested } from "../src/tbtc-bridge"
import { handleRedemptionRequested as handleV3RedemptionRequested } from "../src/bitcoin-redeemer-v3"

// Set up context
const context = new DataSourceContext()
context.setBytes(
  "withdrawalQueueContractAddress",
  Bytes.fromHexString("0xa7049b83dB603f4a7FE93B29D2DfEa76065e76E8"),
)
const bitcoinRedeemerV3ContractAddress = Address.fromString(
  "0xE1d25025835A89C93d56a029C80699BE056584d2",
)
context.setBytes(
  "bitcoinRedeemerV3ContractAddress",
  Bytes.fromHexString(bitcoinRedeemerV3ContractAddress.toHexString()),
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

// --- the unqueued BitcoinRedeemerV3 path -----------------------------------
//
// Same tBTC Bridge event, but the receipt carries a `BitcoinRedeemerV3` log
// instead of a `WithdrawalQueue` one. `BitcoinRedeemerV2` declares an event of
// the same name and the same canonical signature, so the emitter address is the
// only thing that distinguishes them - hence the negative case below.
const v3Owner = Address.fromString("0x000000000000000000000000000000000000dEaD")
const v3Shares = BigInt.fromI32(900)
const v3TbtcAmount = BigInt.fromI32(990)
const v3LogIndex = BigInt.fromI32(7)

const v3BridgeEvent = createBareRedemptionRequestedEvent()
const v3WithdrawId = `${v3BridgeEvent.transaction.hash.toHexString()}_${v3LogIndex.toString()}`

attachRedemptionRequestedLogToReceipt(
  v3BridgeEvent,
  buildRedemptionRequestedLog(
    bitcoinRedeemerV3ContractAddress,
    v3Owner,
    v3Shares,
    v3TbtcAmount,
    v3BridgeEvent.transaction.hash,
    v3LogIndex,
  ),
)

const v2BridgeEvent = createBareRedemptionRequestedEvent()
attachRedemptionRequestedLogToReceipt(
  v2BridgeEvent,
  buildRedemptionRequestedLog(
    // BitcoinRedeemerV2 - a different address, identical event topic.
    Address.fromString("0x42A5f91586DDf041A6084494B0b375CdA34d55e9"),
    v3Owner,
    v3Shares,
    v3TbtcAmount,
    v2BridgeEvent.transaction.hash,
    v3LogIndex,
  ),
)

// The load-bearing invariant of this path: `bitcoin-redeemer-v3.ts`
// and `tbtc-bridge.ts` derive the withdrawal id from the same log, so the two
// stages have to land on one entity rather than two.
const v3RedeemerEvent = createV3RedemptionRequestedEvent(
  v3Owner,
  v3Shares,
  v3TbtcAmount,
  v3BridgeEvent.transaction.hash,
  v3LogIndex,
)

describe("handleRedemptionRequested for BitcoinRedeemerV3", () => {
  describe("when both stages of the same redemption are indexed", () => {
    beforeAll(() => {
      handleV3RedemptionRequested(v3RedeemerEvent)
      handleRedemptionRequested(v3BridgeEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should produce exactly one withdrawal, not two", () => {
      assert.entityCount("Withdraw", 1)
      assert.fieldEquals("Withdraw", v3WithdrawId, "destination", "Bitcoin")
    })

    test("should carry both the requested and the initialized event", () => {
      assert.entityCount("Event", 2)
      assert.fieldEquals(
        "Event",
        `${v3WithdrawId}_RedemptionRequested`,
        "type",
        "Requested",
      )
      assert.fieldEquals(
        "Event",
        `${v3BridgeEvent.transaction.hash.toHexString()}_RedemptionRequested`,
        "type",
        "Initialized",
      )
    })
  })

  describe("when the receipt carries a BitcoinRedeemerV3 log", () => {
    beforeAll(() => {
      handleRedemptionRequested(v3BridgeEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should attribute the withdrawal to the acreBTC share owner", () => {
      assert.fieldEquals(
        "Withdraw",
        v3WithdrawId,
        "depositOwner",
        v3Owner.toHexString(),
      )
    })

    test("should key it the same way the redeemer handler does", () => {
      assert.entityCount("Withdraw", 1)
    })

    test("should set the bridged amount", () => {
      assert.fieldEquals(
        "Withdraw",
        v3WithdrawId,
        "amount",
        v3TbtcAmount.toString(),
      )
    })

    test("should mark the redemption as initialized", () => {
      assert.fieldEquals(
        "Event",
        `${v3BridgeEvent.transaction.hash.toHexString()}_RedemptionRequested`,
        "type",
        "Initialized",
      )
    })

    test("should register the redemption key so the proof can finalize it", () => {
      assert.entityCount("RedemptionKeyToPendingWithdrawal", 1)
    })
  })

  describe("when the redeemer log comes from BitcoinRedeemerV2", () => {
    beforeAll(() => {
      handleRedemptionRequested(v2BridgeEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should not be treated as an Acre redemption", () => {
      assert.entityCount("Withdraw", 0)
      assert.entityCount("Event", 0)
    })
  })
})
