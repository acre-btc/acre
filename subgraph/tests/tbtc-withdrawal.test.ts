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
  Bytes,
  DataSourceContext,
} from "@graphprotocol/graph-ts"
import {
  createRedeemAndBridgeRequestedEvent,
  createRedeemFeeRequestedEvent,
  createRedeemRequestedEvent,
} from "./withdrawal-queue-utils"
import {
  createRedemptionRequestedEvent,
  createWithdrawEvent,
} from "./acrebtc-utils"
import { createSafeApproveRequestEvent } from "./midas-redemption-vault-utils"
import { createRedemptionRequestedEvent as createV3RedemptionRequestedEvent } from "./bitcoin-redeemer-v3-utils"
import {
  handleRedeemAndBridgeRequested,
  handleRedeemFeeRequested,
  handleRedeemRequested,
} from "../src/withdrawal-queue"
import { handleRedemptionRequested, handleWithdraw } from "../src/acrebtc"
import { handleApproveRequest } from "../src/midas-redemption-vault"
import { handleRedemptionRequested as handleV3RedemptionRequested } from "../src/bitcoin-redeemer-v3"

// Contracts
const acrebtcContractAddress = "0xB8ba4B007321e0EB4586De49E59593E0eD66d367"
const stbtcContractAddress = Address.fromString(
  "0x7e184179b1F95A9ca398E6a16127f06b81Cb37a3",
)
const bitcoinRedeemerV3ContractAddress = Address.fromString(
  "0xE1d25025835A89C93d56a029C80699BE056584d2",
)

// Accounts
const owner = Address.fromString("0x0000000000000000000000000000000000000001")
const receiver = Address.fromString(
  "0x0000000000000000000000000000000000000002",
)

const context = new DataSourceContext()
context.setBytes(
  "stbtcContractAddress",
  Bytes.fromHexString(stbtcContractAddress.toHexString()),
)
context.setBytes(
  "bitcoinRedeemerV3ContractAddress",
  Bytes.fromHexString(bitcoinRedeemerV3ContractAddress.toHexString()),
)

dataSourceMock.setReturnValues(acrebtcContractAddress, "sepolia", context)

// A withdrawal through the queue. Mirrors mainnet request 102 in shape: the
// queue request id and the Midas request id are unrelated counters.
const requestId = BigInt.fromI32(102)
const midasRequestId = BigInt.fromI32(116)
const tbtcAmount = BigInt.fromI32(1000)
const exitFeeInTbtc = BigInt.fromI32(25)
const midasShares = BigInt.fromI32(880)
const shares = BigInt.fromI32(900)

const redeemFeeRequestedEvent = createRedeemFeeRequestedEvent(
  requestId,
  BigInt.fromI32(117),
  exitFeeInTbtc,
  BigInt.fromI32(20),
)
const redeemRequestedEvent = createRedeemRequestedEvent(
  requestId,
  receiver,
  midasRequestId,
  tbtcAmount,
  midasShares,
)
const redemptionRequestedEvent = createRedemptionRequestedEvent(
  requestId,
  owner,
  receiver,
  owner,
  shares,
)
const requestedEventId = `${redemptionRequestedEvent.transaction.hash.toHexString()}_${requestId.toString()}_RedemptionRequested`

const settlementTransactionHash = Bytes.fromHexString(
  "0xb383989d30c935ae3d01be27e6be33b48a35ac794e7931cf06c9f28b38f7266c",
)
const safeApproveRequestEvent = createSafeApproveRequestEvent(
  midasRequestId,
  BigInt.fromI32(1),
  settlementTransactionHash,
)
const finalizedEventId = `${settlementTransactionHash.toHexString()}_${requestId.toString()}_MidasRedeemApproved`

const unrelatedSafeApproveRequestEvent = createSafeApproveRequestEvent(
  BigInt.fromI32(999),
  BigInt.fromI32(1),
  Bytes.fromHexString(`0x${"11".repeat(32)}`),
)

const redeemAndBridgeRequestedEvent = createRedeemAndBridgeRequestedEvent(
  requestId,
  owner,
  midasRequestId,
  tbtcAmount,
  exitFeeInTbtc,
  midasShares,
)

// A withdrawal straight from acreBTC. This one really does complete in a
// single transaction - the tBTC lands in the receiver's wallet there and then.
const assets = BigInt.fromI32(1000)
const withdrawEvent = createWithdrawEvent(
  owner,
  receiver,
  owner,
  assets,
  shares,
)
const withdrawId = `${withdrawEvent.transaction.hash.toHexString()}_${withdrawEvent.logIndex.toString()}`
// BitcoinRedeemerV3 redeems the shares to itself before bridging them.
const redeemerV3WithdrawEvent = createWithdrawEvent(
  bitcoinRedeemerV3ContractAddress,
  bitcoinRedeemerV3ContractAddress,
  owner,
  assets,
  shares,
)

const v3TbtcAmount = BigInt.fromI32(990)
const v3TransactionHash = Bytes.fromHexString(`0x${"22".repeat(32)}`)
const v3LogIndex = BigInt.fromI32(3)
const v3RedemptionRequestedEvent = createV3RedemptionRequestedEvent(
  owner,
  shares,
  v3TbtcAmount,
  v3TransactionHash,
  v3LogIndex,
)
const v3WithdrawId = `${v3TransactionHash.toHexString()}_${v3LogIndex.toString()}`

function handleRedeemRequest(): void {
  // The contract emits in this order within a single transaction.
  handleRedeemFeeRequested(redeemFeeRequestedEvent)
  handleRedeemRequested(redeemRequestedEvent)
  handleRedemptionRequested(redemptionRequestedEvent)
}

describe("withdrawal to tBTC through the withdrawal queue", () => {
  describe("when the redemption has been requested", () => {
    beforeAll(() => {
      handleRedeemRequest()
    })

    afterAll(() => {
      clearStore()
    })

    test("should create a withdrawal owned by the acreBTC share owner", () => {
      assert.entityCount("Withdraw", 1)
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "depositOwner",
        owner.toHexString(),
      )
    })

    test("should mark the withdrawal as going to Ethereum", () => {
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "destination",
        "Ethereum",
      )
    })

    test("should keep the exit fee out of the amount to redeem", () => {
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "amountToRedeem",
        tbtcAmount.toString(),
      )
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "requestedAmount",
        tbtcAmount.plus(exitFeeInTbtc).toString(),
      )
    })

    test("should create exactly one requested event", () => {
      assert.entityCount("Event", 1)
      assert.fieldEquals("Event", requestedEventId, "type", "Requested")
    })

    test("should remember which Midas request settles the withdrawal", () => {
      assert.fieldEquals(
        "MidasRequestToWithdrawal",
        midasRequestId.toString(),
        "withdrawId",
        requestId.toString(),
      )
    })
  })

  describe("when the Midas vault settles the request", () => {
    beforeAll(() => {
      handleRedeemRequest()
      handleApproveRequest(safeApproveRequestEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should finalize the withdrawal", () => {
      assert.entityCount("Event", 2)
      assert.fieldEquals("Event", finalizedEventId, "type", "Finalized")
    })

    test("should set the redeemed amount", () => {
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "amount",
        tbtcAmount.toString(),
      )
    })
  })

  describe("when the settled Midas request is not ours", () => {
    beforeAll(() => {
      handleApproveRequest(unrelatedSafeApproveRequestEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should not create anything", () => {
      assert.entityCount("Withdraw", 0)
      assert.entityCount("Event", 0)
    })
  })

  describe("when the redemption is bridged to Bitcoin instead", () => {
    beforeAll(() => {
      handleRedeemAndBridgeRequested(redeemAndBridgeRequestedEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should mark the withdrawal as going to Bitcoin", () => {
      assert.fieldEquals(
        "Withdraw",
        requestId.toString(),
        "destination",
        "Bitcoin",
      )
    })

    test("should not register the Midas request, so Midas cannot finalize it", () => {
      assert.entityCount("MidasRequestToWithdrawal", 0)
    })
  })
})

describe("withdrawal to tBTC directly from acreBTC", () => {
  describe("when the receiver is an Ethereum address", () => {
    beforeAll(() => {
      handleWithdraw(withdrawEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create a withdrawal owned by the acreBTC share owner", () => {
      assert.entityCount("Withdraw", 1)
      assert.fieldEquals(
        "Withdraw",
        withdrawId,
        "depositOwner",
        owner.toHexString(),
      )
    })

    test("should mark the withdrawal as going to Ethereum", () => {
      assert.fieldEquals("Withdraw", withdrawId, "destination", "Ethereum")
    })

    test("should set all amounts to the redeemed assets", () => {
      assert.fieldEquals("Withdraw", withdrawId, "amount", assets.toString())
      assert.fieldEquals(
        "Withdraw",
        withdrawId,
        "amountToRedeem",
        assets.toString(),
      )
      assert.fieldEquals(
        "Withdraw",
        withdrawId,
        "requestedAmount",
        assets.toString(),
      )
    })

    test("should request and finalize in the same transaction", () => {
      assert.entityCount("Event", 2)
      assert.fieldEquals(
        "Event",
        `${withdrawId}_WithdrawRequested`,
        "type",
        "Requested",
      )
      assert.fieldEquals(
        "Event",
        `${withdrawId}_WithdrawFinalized`,
        "type",
        "Finalized",
      )
    })
  })

  describe("when the receiver is the Bitcoin redeemer", () => {
    beforeAll(() => {
      handleWithdraw(redeemerV3WithdrawEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should not record it as a withdrawal to tBTC", () => {
      assert.entityCount("Withdraw", 0)
      assert.entityCount("Event", 0)
    })
  })
})

// --- Bitcoin withdrawal through BitcoinRedeemerV3 --------------------------
//
// Not queued, unlike `BitcoinRedeemerV2`: the redeem and the hand-off to the
// tBTC Bridge both happen in the request transaction, so `Requested` and
// `Initialized` land together. The Bitcoin is still not delivered at that
// point - `Finalized` only arrives with the redemption proof, hours later.
describe("withdrawal to BTC through BitcoinRedeemerV3", () => {
  describe("when the redemption is requested", () => {
    beforeAll(() => {
      handleV3RedemptionRequested(v3RedemptionRequestedEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should create a withdrawal owned by the acreBTC share owner", () => {
      assert.entityCount("Withdraw", 1)
      assert.fieldEquals(
        "Withdraw",
        v3WithdrawId,
        "depositOwner",
        owner.toHexString(),
      )
    })

    test("should mark the withdrawal as going to Bitcoin", () => {
      assert.fieldEquals("Withdraw", v3WithdrawId, "destination", "Bitcoin")
    })

    test("should set the amounts from the bridged tBTC", () => {
      assert.fieldEquals(
        "Withdraw",
        v3WithdrawId,
        "amountToRedeem",
        v3TbtcAmount.toString(),
      )
      assert.fieldEquals(
        "Withdraw",
        v3WithdrawId,
        "requestedAmount",
        v3TbtcAmount.toString(),
      )
    })

    test("should create a single requested event", () => {
      assert.entityCount("Event", 1)
      assert.fieldEquals(
        "Event",
        `${v3WithdrawId}_RedemptionRequested`,
        "type",
        "Requested",
      )
    })
  })

  describe("when acreBTC reports the redeem to the redeemer", () => {
    beforeAll(() => {
      handleV3RedemptionRequested(v3RedemptionRequestedEvent)
      handleWithdraw(redeemerV3WithdrawEvent)
    })

    afterAll(() => {
      clearStore()
    })

    test("should not add a second withdrawal for the same redemption", () => {
      assert.entityCount("Withdraw", 1)
      assert.fieldEquals("Withdraw", v3WithdrawId, "destination", "Bitcoin")
    })
  })
})
