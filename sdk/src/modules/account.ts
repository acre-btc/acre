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
      subgraphData
        .filter((d) => d.status !== DepositStatus.Migrated)
        .map((data) => [data.depositKey, data]),
    )

    const tbtcData = await this.#tbtc.getDepositsByOwner(this.#ethereumAddress)

    const migratedDeposits = subgraphData
      .filter((d) => d.status === DepositStatus.Migrated)
      .map((migratedDeposit) => ({
        // In that case this is not actually the deposit key.It's a migrated
        // deposit and the id is `<txHash>_<log_index>`.
        id: migratedDeposit.depositKey,
        // For migrated deposit the bitcoin tx hash is null.
        txHash: migratedDeposit.txHash,
        amount: toSatoshi(migratedDeposit.amountToDeposit),
        status: migratedDeposit.status,
        initializedAt: migratedDeposit.initializedAt,
        finalizedAt: migratedDeposit.initializedAt,
      }))

    return tbtcData
      .map((deposit) => {
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
      .concat(migratedDeposits)
  }

  /**
   * Builds the callback OrangeKit uses to have the user sign the Safe
   * transaction. Shared by both withdrawal paths so they cannot drift apart.
   * @param onSignMessageStepCallback A callback triggered before the message
   *        signing step.
   * @param messageSignedStepCallback A callback triggered after the message
   *        signing step.
   * @returns The callback passed to `OrangeKitSdk#sendTransaction`.
   */
  #buildSignCallback(
    onSignMessageStepCallback?: OnSignMessageStepCallback,
    messageSignedStepCallback?: MessageSignedStepCallback,
  ) {
    return async (message: string, txData: SafeTransactionData) => {
      await onSignMessageStepCallback?.(message)
      const signedMessage = await (this.#bitcoinProvider.signWithdrawMessage?.(
        message,
        txData,
      ) ?? (await this.#bitcoinProvider.signMessage(message)))

      await messageSignedStepCallback?.(signedMessage)

      return signedMessage
    }
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
      this.#buildSignCallback(
        onSignMessageStepCallback,
        messageSignedStepCallback,
      ),
    )

    const redemptionRequestId =
      await this.#contracts.bitcoinRedeemer.findRedemptionRequestIdFromTransaction(
        Hex.from(transactionHash),
      )
    return { transactionHash, redemptionRequestId }
  }

  /**
   * Requests a redemption of the account's AcreBTC position for tBTC, paid out
   * to the given Ethereum address.
   *
   * This is the tBTC-to-EVM counterpart of {Account#initializeWithdrawal}, and
   * it is asynchronous: `acreBTC.requestRedeem` moves the shares to the
   * withdrawal queue, which requests a redemption of the underlying Midas
   * position. The tBTC reaches `receiverEvmAddress` once that redemption
   * settles at the next NAV update - not when this transaction is mined.
   *
   * Because the account's Safe is both the caller and the owner of the shares,
   * the vault does not touch the allowance and no approval step is involved.
   * @param btcAmount Bitcoin amount to withdraw in 1e8 satoshi precision.
   * @param receiverEvmAddress `0x`-prefixed Ethereum address that will receive
   *        the tBTC. This MUST be an address the user controls and can move
   *        funds from - the account's own Safe holds no ETH and cannot relay
   *        the tBTC back out. The contract handle parses it and throws if it
   *        is not a valid address, but it cannot tell who controls it.
   * @param dataBuiltStepCallback A callback triggered after the data
   *        building step.
   * @param onSignMessageStepCallback A callback triggered before the message
   *        signing step.
   * @param messageSignedStepCallback A callback triggered after the message
   *        signing step.
   * @returns Hash of the withdrawal transaction and the redemption request id.
   */
  async initializeTbtcWithdrawal(
    btcAmount: bigint,
    receiverEvmAddress: string,
    dataBuiltStepCallback?: DataBuiltStepCallback,
    onSignMessageStepCallback?: OnSignMessageStepCallback,
    messageSignedStepCallback?: MessageSignedStepCallback,
  ): Promise<{ transactionHash: string; redemptionRequestId: bigint }> {
    const tbtcAmount = fromSatoshi(btcAmount)
    const shares = await this.#contracts.acreBTC.convertToShares(tbtcAmount)

    // The receiver is the user's own address; the owner is the account's Safe,
    // which holds the shares. Swapping the two would send the tBTC to a Safe
    // that has no ETH and cannot move it on. The address is passed through as
    // a string - parsing it belongs to the contract handle, which is the layer
    // that knows the chain.
    const safeTxData = this.#contracts.acreBTC.encodeRequestRedeemFunctionData(
      shares,
      receiverEvmAddress,
      this.#ethereumAddress,
    )

    await dataBuiltStepCallback?.(safeTxData)

    const transactionHash = await this.#orangeKitSdk.sendTransaction(
      `0x${this.#contracts.acreBTC.getChainIdentifier().identifierHex}`,
      "0x0",
      safeTxData.toPrefixedString(),
      this.#bitcoinAddress,
      this.#bitcoinPublicKey,
      this.#buildSignCallback(
        onSignMessageStepCallback,
        messageSignedStepCallback,
      ),
    )

    const redemptionRequestId =
      await this.#contracts.acreBTC.findRedemptionRequestIdFromTransaction(
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
      if (withdraw.initializedAt) status = "initialized"
      if (withdraw.finalizedAt) status = "finalized"

      return {
        ...withdraw,
        amount: toSatoshi(withdraw.amount),
        requestedAmount: toSatoshi(withdraw.requestedAmount),
        status,
      }
    })
  }
}
