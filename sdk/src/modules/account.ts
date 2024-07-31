import { OrangeKitSdk } from "@orangekit/sdk"
import { AcreContracts, ChainIdentifier } from "../lib/contracts"
import StakeInitialization from "./staking"
import { fromSatoshi, toSatoshi } from "../lib/utils"
import Tbtc from "./tbtc"
import AcreSubgraphApi from "../lib/api/AcreSubgraphApi"
import { DepositStatus } from "../lib/api/TbtcApi"
import OrangeKitTbtcRedeemerProxy, {
  MessageSignedStepCallback,
  OnSignMessageStepCallback,
} from "../lib/redeemer-proxy"
import { BitcoinProvider } from "../lib/bitcoin"

export { DepositReceipt } from "./tbtc"

/**
 * Represents the deposit data.
 */
export type Deposit = {
  /**
   * Unique deposit identifier represented as
   * `keccak256(bitcoinFundingTxHash | fundingOutputIndex)`.
   */
  id: string
  /**
   * Bitcoin transaction hash (or transaction ID) in the same byte order as
   * used by the Bitcoin block explorers.
   */
  txHash: string
  /**
   * Amount of Bitcoin funding transaction.
   */
  amount: bigint
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

/**
 * Module exposing features related to the account.
 */
export default class Account {
  /**
   * Acre contracts.
   */
  readonly #contracts: AcreContracts

  /**
   * tBTC Module.
   */
  readonly #tbtc: Tbtc

  /**
   * Acre subgraph api.
   */
  readonly #acreSubgraphApi: AcreSubgraphApi

  readonly #bitcoinAddress: string

  readonly #ethereumAddress: ChainIdentifier

  readonly #bitcoinPublicKey: string

  readonly #bitcoinProvider: BitcoinProvider

  readonly #orangeKitSdk: OrangeKitSdk

  constructor(
    contracts: AcreContracts,
    tbtc: Tbtc,
    acreSubgraphApi: AcreSubgraphApi,
    account: {
      bitcoinAddress: string
      bitcoinPublicKey: string
      ethereumAddress: ChainIdentifier
    },
    bitcoinProvider: BitcoinProvider,
    orangeKitSdk: OrangeKitSdk,
  ) {
    this.#contracts = contracts
    this.#tbtc = tbtc
    this.#acreSubgraphApi = acreSubgraphApi
    this.#bitcoinAddress = account.bitcoinAddress
    this.#ethereumAddress = account.ethereumAddress
    this.#bitcoinProvider = bitcoinProvider
    this.#orangeKitSdk = orangeKitSdk
    this.#bitcoinPublicKey = account.bitcoinPublicKey
  }

  /**
   * Initializes the Acre deposit process.
   * @param referral Data used for referral program.
   * @param bitcoinRecoveryAddress `P2PKH` or `P2WPKH` Bitcoin address that can
   *        be used for emergency recovery of the deposited funds. If
   *        `undefined` the bitcoin address from bitcoin provider is used as
   *        bitcoin recovery address - note that an address returned by bitcoin
   *        provider must then be `P2WPKH` or `P2PKH`. This property is
   *        available to let the consumer use `P2SH-P2WPKH` as the deposit owner
   *        and another tBTC-supported type (`P2WPKH`, `P2PKH`) address as the
   *        tBTC Bridge recovery address.
   * @returns Object represents the deposit process.
   */
  async initializeStake(
    referral: number,
    bitcoinRecoveryAddress?: string,
  ): Promise<StakeInitialization> {
    // tBTC-v2 SDK will handle Bitcoin address validation and throw an error if
    // address is not supported.
    const finalBitcoinRecoveryAddress =
      bitcoinRecoveryAddress ?? this.#bitcoinAddress

    const tbtcDeposit = await this.#tbtc.initiateDeposit(
      this.#ethereumAddress,
      finalBitcoinRecoveryAddress,
      referral,
    )

    return new StakeInitialization(tbtcDeposit)
  }

  /**
   * @returns Balance of the account's stBTC shares (in 1e18 precision).
   */
  async sharesBalance() {
    return this.#contracts.stBTC.balanceOf(this.#ethereumAddress)
  }

  /**
   * @returns Balance of Bitcoin position in Acre estimated based on the
   *          account's stBTC shares (in 1e8 satoshi precision).
   */
  async estimatedBitcoinBalance() {
    return toSatoshi(
      await this.#contracts.stBTC.assetsBalanceOf(this.#ethereumAddress),
    )
  }

  /**
   * @returns All deposits associated with the account. They include all
   *          deposits: queued, initialized and finalized.
   */
  async getDeposits(): Promise<Deposit[]> {
    const subgraphData = await this.#acreSubgraphApi.getDepositsByOwner(
      this.#ethereumAddress,
    )

    const initializedOrFinalizedDepositsMap = new Map(
      subgraphData.map((data) => [data.depositKey, data]),
    )

    const tbtcData = await this.#tbtc.getDepositsByOwner(this.#ethereumAddress)

    return tbtcData.map((deposit) => {
      const depositFromSubgraph = initializedOrFinalizedDepositsMap.get(
        deposit.depositKey,
      )

      const amount = toSatoshi(
        depositFromSubgraph?.initialAmount ?? deposit.initialAmount,
      )

      return {
        id: deposit.depositKey,
        txHash: deposit.txHash,
        amount,
        status: deposit.status,
        initializedAt: deposit.initializedAt,
        finalizedAt: depositFromSubgraph?.finalizedAt,
      }
    })
  }

  /**
   * Initializes the withdrawal process.
   * @param amount Bitcoin amount to withdraw in 1e8 satoshi precision.
   * @param onSignMessageStepCallback A callback triggered before the message
   *        signing step.
   * @param messageSignedStepCallback A callback triggered after the message
   *        signing step.
   * @returns Hash of the withdrawal transaction and the redemption key.
   */
  async initializeWithdrawal(
    btcAmount: bigint,
    onSignMessageStepCallback?: OnSignMessageStepCallback,
    messageSignedStepCallback?: MessageSignedStepCallback,
  ): Promise<{ transactionHash: string; redemptionKey: string }> {
    const tbtcAmount = fromSatoshi(btcAmount)
    const shares = await this.#contracts.stBTC.convertToShares(tbtcAmount)
    // Including fees.
    const redeemedTbtc = await this.#contracts.stBTC.previewRedeem(shares)

    const redeemerProxy = new OrangeKitTbtcRedeemerProxy(
      this.#contracts,
      this.#orangeKitSdk,
      {
        bitcoinAddress: this.#bitcoinAddress,
        ethereumAddress: this.#ethereumAddress,
        publicKey: this.#bitcoinPublicKey,
      },
      this.#bitcoinProvider,
      shares,
      onSignMessageStepCallback,
      messageSignedStepCallback,
    )

    return this.#tbtc.initiateRedemption(
      this.#bitcoinAddress,
      redeemedTbtc,
      redeemerProxy,
    )
  }

  /**
   * @returns All withdrawals associated with the account.
   */
  async getWithdrawals(): Promise<
    {
      id: string
      amount: bigint
      bitcoinTransactionId?: string
      status: "initialized" | "finalized"
      initializedAt: number
      finalizedAt: number
    }[]
  > {
    return (
      await this.#acreSubgraphApi.getWithdrawalsByOwner(this.#ethereumAddress)
    ).map((withdraw) => ({
      ...withdraw,
      amount: toSatoshi(withdraw.amount),
      status: withdraw.bitcoinTransactionId ? "finalized" : "initialized",
    }))
  }
}
