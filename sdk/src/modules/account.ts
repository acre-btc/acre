import { OrangeKitSdk, SafeTransactionData } from "@orangekit/sdk"
import { AcreContracts, ChainIdentifier } from "../lib/contracts"
import StakeInitialization from "./staking"
import { fromSatoshi, toSatoshi, Hex } from "../lib/utils"
import Tbtc from "./tbtc"
import AcreSubgraphApi from "../lib/api/AcreSubgraphApi"
import { DepositStatus } from "../lib/api/TbtcApi"
import { AcreBitcoinProvider } from "../lib/bitcoin"

export { DepositReceipt } from "./tbtc"

export type DataBuiltStepCallback = (safeTxData: Hex) => Promise<void>
export type OnSignMessageStepCallback = (messageToSign: string) => Promise<void>
export type MessageSignedStepCallback = (signedMessage: string) => Promise<void>

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

type WithdrawalStatus = "requested" | "initialized" | "finalized"

export type Withdrawal = {
  id: string
  requestedAmount: bigint
  amount?: bigint
  bitcoinTransactionId?: string
  status: WithdrawalStatus
  requestedAt: number
  initializedAt?: number
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

  readonly #bitcoinProvider: AcreBitcoinProvider

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
    bitcoinProvider: AcreBitcoinProvider,
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
      this.#bitcoinAddress,
    )

    return new StakeInitialization(tbtcDeposit)
  }

  /**
   * @returns Balance of the account's acreBTC shares (in 1e18 precision).
   */
  async sharesBalance() {
    return this.#contracts.acreBTC.balanceOf(this.#ethereumAddress)
  }

  /**
   * @returns Balance of Bitcoin position in Acre estimated based on the
   *          account's acreBTC shares (in 1e8 satoshi precision).
   */
  async estimatedBitcoinBalance() {
    return toSatoshi(
      await this.#contracts.acreBTC.assetsBalanceOf(this.#ethereumAddress),
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
        depositFromSubgraph?.amountToDeposit || deposit.initialAmount,
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
   * @param dataBuiltStepCallback A callback triggered after the data
   *        building step.
   * @param onSignMessageStepCallback A callback triggered before the message
   *        signing step.
   * @param messageSignedStepCallback A callback triggered after the message
   *        signing step.
   * @returns Hash of the withdrawal transaction and the redemption request id.
   */
  async initializeWithdrawal(
    btcAmount: bigint,
    dataBuiltStepCallback?: DataBuiltStepCallback,
    onSignMessageStepCallback?: OnSignMessageStepCallback,
    messageSignedStepCallback?: MessageSignedStepCallback,
  ): Promise<{ transactionHash: string; redemptionRequestId: bigint }> {
    const tbtcAmount = fromSatoshi(btcAmount)
    const shares = await this.#contracts.acreBTC.convertToShares(tbtcAmount)

    const safeTxData = this.#contracts.acreBTC.encodeApproveAndCallFunctionData(
      this.#contracts.bitcoinRedeemer.getChainIdentifier(),
      shares,
      this.#tbtc.buildRedemptionData(
        this.#ethereumAddress,
        this.#bitcoinAddress,
      ),
    )

    await dataBuiltStepCallback?.(safeTxData)

    const transactionHash = await this.#orangeKitSdk.sendTransaction(
      `0x${this.#contracts.acreBTC.getChainIdentifier().identifierHex}`,
      "0x0",
      safeTxData.toPrefixedString(),
      this.#bitcoinAddress,
      this.#bitcoinPublicKey,
      async (message: string, txData: SafeTransactionData) => {
        await onSignMessageStepCallback?.(message)
        const signedMessage =
          await (this.#bitcoinProvider.signWithdrawMessage?.(message, txData) ??
            (await this.#bitcoinProvider.signMessage(message)))

        await messageSignedStepCallback?.(signedMessage)

        return signedMessage
      },
    )

    const redemptionRequestId =
      await this.#contracts.bitcoinRedeemer.findRedemptionRequestIdFromTransaction(
        Hex.from(transactionHash),
      )
    return { transactionHash, redemptionRequestId }
  }

  /**
   * @returns All withdrawals associated with the account.
   */
  async getWithdrawals(): Promise<Withdrawal[]> {
    return (
      await this.#acreSubgraphApi.getWithdrawalsByOwner(this.#ethereumAddress)
    ).map((withdraw) => {
      let status: WithdrawalStatus = "requested"
      if (withdraw.amount) status = "initialized"
      if (withdraw.bitcoinTransactionId) status = "finalized"

      return {
        ...withdraw,
        amount: withdraw.amount ? toSatoshi(withdraw.amount) : undefined,
        requestedAmount: toSatoshi(withdraw.requestedAmount),
        status,
      }
    })
  }
}
