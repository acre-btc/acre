/**
 * Routes the native-BTC withdrawal path - AcreBTC shares -> tBTC -> Bitcoin -
 * through the tBTC SDK, as a single user transaction.
 *
 * The redeemer this targets is synchronous: `receiveApproval` runs
 * `acreBtc.redeem(shares, address(this), owner)` and then
 * `tbtcToken.approveAndCall(tbtcVault, tbtcAmount, tbtcRedemptionData)`, so the
 * wallet and main UTXO carried by the redemption data reach
 * `Bridge.requestRedemption` for real and must be live values. They are
 * discovered client-side by `redemptions.requestRedemptionWithProxy`.
 *
 * Do NOT hand-roll the redemption-data encoding here. It is produced by
 * `tbtcToken.buildRequestRedemptionData` inside
 * `redemptions.requestRedemptionWithProxy`. A previous hand-rolled encoder
 * omitted the redeemer-output-script length prefix and broke real mainnet
 * withdrawals (see 6ed72690).
 */
import { RedeemerProxy as TbtcRedeemerProxy } from "@keep-network/tbtc-v2.ts"
import { OrangeKitSdk } from "@orangekit/sdk"
import { AcreContracts, ChainIdentifier } from "./contracts"
import { AcreBitcoinProvider, SafeTransactionData } from "./bitcoin"
import {
  Hex,
  DataBuiltStepCallback,
  OnSignMessageStepCallback,
  MessageSignedStepCallback,
} from "./utils"

export default class OrangeKitTbtcRedeemerProxy implements TbtcRedeemerProxy {
  #contracts: AcreContracts

  #orangeKitSdk: OrangeKitSdk

  #account: {
    publicKey: string
    bitcoinAddress: string
    ethereumAddress: ChainIdentifier
  }

  #bitcoinProvider: AcreBitcoinProvider

  #sharesAmount: bigint

  #dataBuiltStepCallback?: DataBuiltStepCallback

  #onSignMessageStepCallback?: OnSignMessageStepCallback

  #messageSignedStepCallback?: MessageSignedStepCallback

  constructor(
    contracts: AcreContracts,
    orangeKitSdk: OrangeKitSdk,
    account: {
      publicKey: string
      bitcoinAddress: string
      ethereumAddress: ChainIdentifier
    },
    bitcoinProvider: AcreBitcoinProvider,
    sharesAmount: bigint,
    dataBuiltStepCallback?: DataBuiltStepCallback,
    onSignMessageStepCallback?: OnSignMessageStepCallback,
    messageSignedStepCallback?: MessageSignedStepCallback,
  ) {
    this.#contracts = contracts
    this.#orangeKitSdk = orangeKitSdk
    this.#account = account
    this.#bitcoinProvider = bitcoinProvider
    this.#sharesAmount = sharesAmount
    this.#dataBuiltStepCallback = dataBuiltStepCallback
    this.#onSignMessageStepCallback = onSignMessageStepCallback
    this.#messageSignedStepCallback = messageSignedStepCallback
  }

  redeemerAddress(): ChainIdentifier {
    return this.#account.ethereumAddress
  }

  async requestRedemption(redemptionData: Hex): Promise<Hex> {
    // `redemptionData` is denominated in tBTC, but the transaction below
    // approves AcreBTC *shares* to the redeemer, which converts shares to tBTC
    // on-chain. The two numbers are intentionally in different units - the
    // tBTC amount only ever influenced tBTC wallet selection.
    const safeTxData = this.#contracts.acreBTC.encodeApproveAndCallFunctionData(
      this.#contracts.bitcoinRedeemer.getChainIdentifier(),
      this.#sharesAmount,
      redemptionData,
    )
    await this.#dataBuiltStepCallback?.(safeTxData)

    const transactionHash = await this.#orangeKitSdk.sendTransaction(
      `0x${this.#contracts.acreBTC.getChainIdentifier().identifierHex}`,
      "0x0",
      safeTxData.toPrefixedString(),
      this.#account.bitcoinAddress,
      this.#account.publicKey,
      async (message: string, txData: SafeTransactionData) => {
        await this.#onSignMessageStepCallback?.(message)
        const signedMessage =
          await (this.#bitcoinProvider.signWithdrawMessage?.(message, txData) ??
            (await this.#bitcoinProvider.signMessage(message)))

        await this.#messageSignedStepCallback?.(signedMessage)

        return signedMessage
      },
    )

    return Hex.from(transactionHash)
  }
}
