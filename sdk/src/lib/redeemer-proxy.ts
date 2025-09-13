import {
  ChainIdentifier,
  Hex,
  RedeemerProxy as TbtcRedeemerProxy,
} from "@keep-network/tbtc-v2.ts"
import { OrangeKitSdk } from "@orangekit/sdk"
import { AcreContracts } from "./contracts"
import { AcreBitcoinProvider, SafeTransactionData } from "./bitcoin"

export type DataBuiltStepCallback = (safeTxData: Hex) => Promise<void>
export type OnSignMessageStepCallback = (messageToSign: string) => Promise<void>
export type MessageSignedStepCallback = (signedMessage: string) => Promise<void>

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
