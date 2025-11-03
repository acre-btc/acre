import { ChainIdentifier } from "../contracts"
import HttpApi from "./HttpApi"
import { DepositStatus } from "./TbtcApi"

/**
 * Represents the response data returned form the Acre Subgraph from query that
 * finds all deposits for a given depositor.
 */
type DepositDataResponse = {
  data: {
    deposits: {
      /**
       * Unique deposit identifier represented as
       * `keccak256(bitcoinFundingTxHash | fundingOutputIndex)`.
       */
      id: string
      /**
       * Bitcoin transaction hash (or transaction ID) in the same byte order as
       * used by the Bitcoin block explorers.
       */
      bitcoinTransactionId: string
      /**
       * Amount of tBTC tokens deposited to acreBTC vault - it's equal to
       * `bridgedAmount - depositorFee` (without the acreBTC deposit fee).
       */
      amountToDeposit: string
      /**
       * Amount of Bitcoin funding transaction.
       */
      initialDepositAmount: string
      /**
       * Events associated with a given deposit.
       */
      events: {
        type: "Initialized" | "Finalized" | "Migrated"
        timestamp: string
      }[]
    }[]
  }
}

/**
 * Represents the formatted deposit.
 */
type Deposit = {
  /**
   * Unique deposit identifier represented as `keccak256(bitcoinFundingTxHash |
   * fundingOutputIndex)`.
   */
  depositKey: string
  /**
   * Bitcoin transaction hash (or transaction ID) in the same byte order as used
   * by the Bitcoin block explorers.
   */
  txHash: string
  /**
   * Amount of Bitcoin funding transaction.
   */
  initialAmount: bigint
  /**
   * Amount of tBTC tokens deposited to acreBTC vault - it's equal to
   * `bridgedAmount - depositorFee` (without the acreBTC deposit fee).
   */
  amountToDeposit: bigint
  /**
   * Status of the deposit.
   */
  status: DepositStatus
  /**
   * Timestamp when the deposit was initialized.
   */
  initializedAt: number
  /**
   * Timestamp when the deposit was finalized.
   */
  finalizedAt?: number
}

type WithdrawalsDataResponse = {
  data: {
    withdraws: {
      id: string
      bitcoinTransactionId: string | null
      amount: string
      requestedAmount: string
      amountToRedeem: string
      events: {
        type: "Requested" | "Initialized" | "Finalized"
        timestamp: string
      }[]
    }[]
  }
}

/**
 * Represents the formatted withdrawal.
 */
type Withdrawal = {
  /**
   * Unique withdrawal identifier.
   */
  id: string
  /**
   * Amount of tBTC tokens requested for withdrawal including tBTC exit fees.
   */
  requestedAmount: bigint
  /**
   * Actual amount of tBTC tokens being withdrawn. This may differ from
   * `requestedAmount` due to fees.
   */
  amount: bigint
  /**
   * Bitcoin transaction hash (or transaction ID) in the same byte order as used
   * by the Bitcoin block explorers. Only available after the withdrawal has been
   * finalized.
   */
  bitcoinTransactionId?: string
  /**
   * Timestamp when the withdrawal was requested.
   */
  requestedAt: number
  /**
   * Timestamp when the withdrawal was initialized.
   */
  initializedAt?: number
  /**
   * Timestamp when the withdrawal was finalized.
   */
  finalizedAt?: number
}

export function buildGetDepositsByOwnerQuery(owner: ChainIdentifier) {
  return `
  query {
    deposits(
          where: {depositOwner_: {id: "0x${owner.identifierHex}"}}
      ) {
          id
          bitcoinTransactionId
          initialDepositAmount
          events(orderBy: timestamp, orderDirection: asc) {
            timestamp
            type
          }
          amountToDeposit
      }
  }`
}

export function buildGetWithdrawalsByOwnerQuery(owner: ChainIdentifier) {
  return `
  query {
    withdraws(
      where: {depositOwner_contains_nocase: "0x${owner.identifierHex}"}
    ) {
        id
        bitcoinTransactionId
        requestedAmount
        amountToRedeem
        amount
        events(orderBy: timestamp, orderDirection: asc) {
          timestamp
          type
        }
      }
  }`
}

/**
 * Class for integration with Acre Subgraph.
 */
export default class AcreSubgraphApi extends HttpApi {
  /**
   * @param depositOwnerId The deposit owner id as EVM-chain identifier.
   * @returns All deposits for a given depositor. Returns only initialized or
   *          finalized deposits that exist on-chain. They do not included
   *          queued deposits stored by the tBTC API.
   */
  async getDepositsByOwner(
    depositOwnerId: ChainIdentifier,
  ): Promise<Deposit[]> {
    const query = buildGetDepositsByOwnerQuery(depositOwnerId)
    const response = await this.postRequest(
      "",
      { query },
      { credentials: undefined },
    )

    if (!response.ok) {
      throw new Error(
        `Could not get deposits by deposit owner: ${response.status}`,
      )
    }

    const responseData = (await response.json()) as DepositDataResponse

    return responseData.data.deposits.map((deposit) => {
      const {
        bitcoinTransactionId: txHash,
        amountToDeposit,
        initialDepositAmount,
        events,
        id,
      } = deposit

      // The subgraph indexes only initialized, finalized or migrated deposits.
      let status = DepositStatus.Initialized
      if (events.some(({ type }) => type === "Finalized"))
        status = DepositStatus.Finalized
      if (events.some(({ type }) => type === "Migrated"))
        status = DepositStatus.Migrated

      const [initializedEvent, finalizedEvent] = events
      const initializedAt = parseInt(initializedEvent.timestamp, 10)
      const finalizedAt = finalizedEvent
        ? parseInt(finalizedEvent.timestamp, 10)
        : undefined

      return {
        depositKey: id,
        txHash,
        initialAmount: BigInt(initialDepositAmount),
        amountToDeposit: BigInt(amountToDeposit ?? 0),
        type: "deposit",
        status,
        initializedAt,
        finalizedAt,
      }
    })
  }

  async getWithdrawalsByOwner(
    depositOwnerId: ChainIdentifier,
  ): Promise<Withdrawal[]> {
    const query = buildGetWithdrawalsByOwnerQuery(depositOwnerId)

    const response = await this.postRequest(
      "",
      { query },
      { credentials: undefined },
    )

    if (!response.ok) {
      throw new Error(
        `Could not get withdrawals by deposit owner: ${response.status}`,
      )
    }

    const acreWithdrawals = (await response.json()) as WithdrawalsDataResponse

    return acreWithdrawals.data.withdraws.map((withdraw) => {
      const { id, events } = withdraw
      const bitcoinTransactionId = withdraw.bitcoinTransactionId ?? undefined
      const requestedAmount = BigInt(withdraw.requestedAmount)

      // The `amount` field from subgraph is available once the bridging process
      // on the tBTC side has finished. If it's not available let's use the
      // `amountToRedeem` field, available immediately after withdrawal request
      // initialization.
      const amount = withdraw.amount
        ? BigInt(withdraw.amount)
        : BigInt(withdraw.amountToRedeem)

      const [requestedEvent, initializedEvent, finalizedEvent] = events
      const requestedAt = parseInt(requestedEvent.timestamp, 10)
      const initializedAt = initializedEvent
        ? parseInt(initializedEvent.timestamp, 10)
        : undefined
      const finalizedAt = finalizedEvent
        ? parseInt(finalizedEvent.timestamp, 10)
        : undefined

      return {
        id,
        bitcoinTransactionId,
        amount,
        requestedAmount,
        requestedAt,
        initializedAt,
        finalizedAt,
      }
    })
  }
}
