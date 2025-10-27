import {
  BitcoinTxHash,
  BitcoinTxOutpoint,
  ChainIdentifier,
} from "@keep-network/tbtc-v2.ts"
import HttpApi from "./HttpApi"

/**
 * Represents the Deposit entity returned by the tBTC API.
 */
type Deposit = {
  id: string
  createdAt: number
  outputIndex: number
  owner: string
  receipt: {
    blindingFactor: string
    depositor: string
    extraData: string
    refundLocktime: string
    refundPublicKeyHash: string
    walletPublicKeyHash: string
  }
  referral: number
  status: DepositStatus
  txHash: string
  initialAmount: string
}

/**
 * Represents a class for integration with tBTC API.
 */
export default class TbtcApi extends HttpApi {
  /**
   * Register deposit data in the tBTC API.
   * @param revealData Deposit data.
   * @returns True if the reveal was successfully saved to the database, false
   * otherwise.
   */
  async saveReveal(revealData: SaveRevealRequest): Promise<boolean> {
    const response = await this.postRequest("reveals", revealData).catch(
      (error) => {
        throw new Error(`Failed to save reveal: ${error}`)
      },
    )

    const { success } = (await response.json()) as { success: boolean }

    return success
  }

  /**
   * Initiate a bitcoin deposit in the tBTC API.
   * @param depositData Data of the deposit.
   * @returns Details of the initiated deposit.
   */
  async createDeposit(depositData: CreateDepositRequest): Promise<{
    depositId: string
    depositStatus: DepositStatus
    fundingOutpoint: BitcoinTxOutpoint
  }> {
    const response = await this.postRequest("deposits", depositData).catch(
      (error) => {
        throw new Error(`Failed to create deposit: ${error}`)
      },
    )

    const responseData = (await response.json()) as CreateDepositResponse

    return {
      depositId: responseData.depositId,
      depositStatus: responseData.newDepositStatus,
      fundingOutpoint: {
        transactionHash: BitcoinTxHash.from(responseData.transactionHash),
        outputIndex: responseData.outputIndex,
      },
    }
  }

  /**
   * @param depositOwner Depositor as EVM-chain identifier.
   * @returns All owner deposits, including queued deposits.
   */
  async getDepositsByOwner(depositOwner: ChainIdentifier): Promise<Deposit[]> {
    const response = await this.getRequest(
      `deposits/${depositOwner.identifierHex}`,
    ).catch((error) => {
      throw new Error(`Failed to fetch deposits: ${error}`)
    })

    const responseData = (await response.json()) as Deposit[]

    return responseData
  }
}

/**
 * Represents the metadata for a reveal operation.
 */
type RevealMetadata = {
  depositOwner: string
  referral: number
}

// TODO: This type is copied from tbtc-api, we should consider exporting it from there.
/**
 * Represents the request payload for saving a reveal.
 */
export type SaveRevealRequest = {
  address: string
  revealInfo: BitcoinDepositReceiptJson
  metadata: RevealMetadata
  application: string
  loggedInUser?: string
}

// TODO: This type is copied from tbtc-api, we should consider exporting it from there.
/**
 * Represents the JSON structure of a Bitcoin deposit receipt.
 */
type BitcoinDepositReceiptJson = {
  depositor: string
  blindingFactor: string
  walletPublicKeyHash: string
  refundPublicKeyHash: string
  refundLocktime: string
  extraData: string
}

// TODO: This type is copied from tbtc-api, we should consider exporting it from there.
/**
 * Represents the request payload for creating a deposit.
 */
type CreateDepositRequest = {
  depositReceipt: BitcoinDepositReceiptJson
  depositOwner: string
  referral: number
}

// TODO: This type is copied from tbtc-api, we should consider exporting it from there.
/**
 * Represents the status of a deposit.
 */
export enum DepositStatus {
  Queued = "QUEUED",
  Initialized = "INITIALIZED",
  Finalized = "FINALIZED",
  Cancelled = "CANCELLED",
  Migrated = "MIGRATED",
}

// TODO: This type is copied from tbtc-api, we should consider exporting it from there.
/**
 * Represents the response structure of a deposit creation request.
 */
type CreateDepositResponse = {
  depositId: string
  newDepositStatus: DepositStatus
  transactionHash: string
  outputIndex: number
}
