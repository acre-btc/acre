import {
  Account,
  defaultLogger,
  WalletAPIClient,
  WindowMessageTransport,
} from "@ledgerhq/wallet-api-client"
import { UserRejectedRequestError } from "viem"
import {
  Balance,
  BitcoinAddress,
  BitcoinTxHash,
  OrangeKitBitcoinWalletProvider,
} from "@orangekit/react/src/wallet/bitcoin-wallet-provider"
import {
  BitcoinNetwork,
  AcreBitcoinProvider,
  BitcoinSignatureHelper,
  SafeTransactionData,
} from "@acre-btc/sdk"
import {
  AcreMessage,
  AcreMessageType,
  AcreModule,
} from "@ledgerhq/wallet-api-acre-module"
import BigNumber from "bignumber.js"

export type TryRequestFn<T> = (fn: () => Promise<T>) => Promise<T>

function tryRequest<T>(): TryRequestFn<T> {
  return async (fn) => {
    try {
      return await fn()
    } catch (error: unknown) {
      const err = error as Error

      // We want to throw the same error for all connectors when user rejects
      // the request.
      if (
        err?.message === "UserRefusedOnDevice" ||
        err?.message === "Canceled by user" ||
        err?.message === "Signature interrupted by user"
      ) {
        throw new UserRejectedRequestError(err)
      }

      throw error
    }
  }
}

function numberToValidHexString(value: number): string {
  let hex = value.toString(16)

  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }

  return `0x${hex}`
}

export type RegisterYieldBearingEthereumAddressResult = {
  /** Whether the registration was successful */
  success: boolean
  /** Generated account name (e.g., "Yield-bearing BTC on ACRE") */
  accountName: string
  /** ID of the created Ethereum parent account */
  parentAccountId: string
  /** ID of the created token sub-account */
  tokenAccountId: string
  /** The registered Ethereum address */
  ethereumAddress: string
  /** The token contract address used */
  tokenContractAddress: string
  /** Additional metadata (if provided) */
  meta?: Record<string, unknown>
}

export type AcreLedgerLiveBitcoinProviderOptions =
  | {
      tryConnectToAddress?: string
      tryConnectToAccountByXpub?: never
    }
  | { tryConnectToAddress?: never; tryConnectToAccountByXpub?: string }

/**
 * Ledger Live Wallet API Bitcoin Provider.
 */
export default class AcreLedgerLiveBitcoinProvider
  implements OrangeKitBitcoinWalletProvider, AcreBitcoinProvider
{
  readonly #walletApiClient: WalletAPIClient<
    (client: WalletAPIClient) => { acre: AcreModule }
  >

  readonly #windowMessageTransport: WindowMessageTransport

  readonly #network: BitcoinNetwork

  readonly #options: AcreLedgerLiveBitcoinProviderOptions

  readonly #hwAppId: string

  readonly #derivationPath = "0/0"

  #hasConnectFunctionBeenCalled: boolean = false

  #account: Account | undefined

  static init(
    network: BitcoinNetwork,
    options: AcreLedgerLiveBitcoinProviderOptions = {
      tryConnectToAddress: undefined,
      tryConnectToAccountByXpub: undefined,
    },
  ) {
    const windowMessageTransport = new WindowMessageTransport()
    windowMessageTransport.connect()

    const walletApiClient = new WalletAPIClient(
      windowMessageTransport,
      defaultLogger,
      (client: WalletAPIClient) => ({ acre: new AcreModule(client) }),
    )

    return new AcreLedgerLiveBitcoinProvider(
      network,
      windowMessageTransport,
      walletApiClient,
      options,
    )
  }

  constructor(
    network: BitcoinNetwork,
    windowMessageTransport: WindowMessageTransport,
    walletApiClient: WalletAPIClient,
    options: AcreLedgerLiveBitcoinProviderOptions = {
      tryConnectToAddress: undefined,
      tryConnectToAccountByXpub: undefined,
    },
  ) {
    this.#network = network
    this.#windowMessageTransport = windowMessageTransport
    this.#walletApiClient = walletApiClient
    this.#options = options
    this.#hwAppId = network === BitcoinNetwork.Mainnet ? "Acre" : "Acre Test"
  }

  /**
   * Connects with the Ledger Live Wallet API.
   * @returns Connected account address.
   */
  async connect(): Promise<BitcoinAddress> {
    this.#windowMessageTransport.connect()

    const currencyIds = [
      this.#network === BitcoinNetwork.Mainnet ? "bitcoin" : "bitcoin_testnet",
    ]

    if (!this.#hasConnectFunctionBeenCalled) {
      const accounts: Account[] = await this.#walletApiClient.account.list({
        currencyIds,
      })

      if (
        this.#options.tryConnectToAddress ||
        this.#options.tryConnectToAccountByXpub
      ) {
        for (let i = 0; i < accounts.length; i += 1) {
          const acc = accounts[i]
          if (
            this.#options.tryConnectToAccountByXpub &&
            // eslint-disable-next-line no-await-in-loop
            (await this.#walletApiClient.bitcoin.getXPub(acc.id)) ===
              this.#options.tryConnectToAccountByXpub
          ) {
            this.#account = acc
            break
          }

          // eslint-disable-next-line no-await-in-loop
          const address = await this.#getAddress(acc.id)
          if (address === this.#options.tryConnectToAddress) {
            this.#account = acc
            break
          }
        }
      } else if (accounts.length === 1) {
        ;[this.#account] = accounts
      }
    }

    if (!this.#account || this.#hasConnectFunctionBeenCalled) {
      this.#account = await tryRequest<Account>()(async () =>
        this.#walletApiClient.account.request({
          currencyIds,
        }),
      )
    }

    this.#hasConnectFunctionBeenCalled = true
    return this.#getAddress(this.#account.id)
  }

  /**
   * Signs and broadcasts a transaction.
   * @param to The address of the transaction's recipient.
   * @param satoshis The amount of Bitcoin in satoshi to send in the
   *        transaction.
   * @returns The transaction hash.
   */
  async sendBitcoin(
    to: BitcoinAddress,
    satoshis: number,
  ): Promise<BitcoinTxHash> {
    if (this.#account === undefined) {
      throw new Error("Connect first")
    }

    // TODO: In the current version of Acre module, sending Bitcoin transactions
    // is not supported. Use the custom Acre module to send Bitcoin transaction
    // once it works correctly.
    const txHash = await tryRequest<string>()(() =>
      this.#walletApiClient.transaction.signAndBroadcast(this.#account!.id, {
        family: "bitcoin",
        amount: new BigNumber(satoshis),
        recipient: to,
      }),
    )

    return txHash
  }

  /**
   * @returns The account Bitcoin balance.
   */
  async getBalance(): Promise<Balance> {
    if (this.#account === undefined) {
      throw new Error("Connect first")
    }

    const account = (
      await this.#walletApiClient.account.list({
        currencyIds: [
          this.#network === BitcoinNetwork.Mainnet
            ? "bitcoin"
            : "bitcoin_testnet",
        ],
      })
    ).find((acc) => acc.id === this.#account!.id)

    if (!account) {
      throw new Error("Failed to get account balance")
    }

    const total = BigInt(account.balance.toString())
    const confirmed = BigInt(account.spendableBalance.toString())

    const balance: Balance = {
      total: total.toString(),
      confirmed: confirmed.toString(),
      unconfirmed: (total - confirmed).toString(),
    }

    return balance
  }

  // eslint-disable-next-line class-methods-use-this
  isInstalled(): boolean {
    return true
  }

  /**
   * Closes the connection with Ledger Live Wallet API.
   */
  disconnect(): Promise<void> {
    this.#account = undefined
    this.#windowMessageTransport.disconnect()

    return Promise.resolve()
  }

  /**
   * In the Ledger Live Wallet API the address is "renewed" each time funds are
   * received in order to allow some privacy. But to get the same depositor
   * owner Ethereum address we must always get the same Bitcoin address (under
   * the `m/purpose'/0'/accountId'/0/0` derivation path).
   *
   * @returns Always the same bitcoin address even the address has been
   *          "renewed" by the Ledger Live Wallet API.
   */
  async getAddress(): Promise<string> {
    if (this.#account === undefined) {
      throw new Error("Connect first")
    }

    return this.#getAddress(this.#account.id)
  }

  #getAddress(accountId: string) {
    return this.#walletApiClient.bitcoin.getAddress(
      accountId,
      this.#derivationPath,
    )
  }

  /**
   * Signs withdraw message.
   * @param message Message to sign.
   * @param data Withdrawal transaction data.
   * @returns A signature for a given message, which proves that the owner of
   *          the account has agreed to the message content.
   */
  async signWithdrawMessage(message: string, data: SafeTransactionData) {
    return this.#signMessage({
      type: AcreMessageType.Withdraw,
      message: {
        ...data,
        operation: data.operation.toString(),
        nonce: numberToValidHexString(data.nonce),
      },
    })
  }

  /**
   * Signs message.
   * @param message Message to sign.
   * @returns A signature for a given message, which proves that the owner of
   *          the account has agreed to the message content.
   * */
  async signMessage(message: string): Promise<string> {
    return this.#signMessage({ type: AcreMessageType.SignIn, message })
  }

  async #signMessage(message: AcreMessage) {
    if (!this.#account) throw new Error("Connect first")

    const signature = await tryRequest<Buffer>()(async () =>
      this.#walletApiClient.custom.acre.messageSign(
        this.#account!.id,
        message,
        this.#derivationPath,
        { hwAppId: this.#hwAppId },
      ),
    )

    return BitcoinSignatureHelper.normalizeSignature(
      signature,
      await this.getAddress(),
      await this.getPublicKey(),
    )
  }

  /**
   * @returns The public key of the Bitcoin account.
   */
  async getPublicKey(): Promise<string> {
    if (this.#account === undefined) {
      throw new Error("Connect first")
    }

    return this.#walletApiClient.bitcoin.getPublicKey(
      this.#account.id,
      this.#derivationPath,
    )
  }

  registerYieldBearingEthereumAddress(params: {
    /** Required: Valid Ethereum address (0x format) */
    ethereumAddress: string
    /** Optional: Token contract address */
    tokenContractAddress?: string
    /** Optional: Token ticker symbol (e.g., stBTC, acreBTC) */
    tokenTicker?: string
    /** Optional: Additional metadata */
    meta?: Record<string, unknown>
  }) {
    return this.#walletApiClient.request(
      "custom.acre.registerYieldBearingEthereumAddress",
      params,
    ) as Promise<RegisterYieldBearingEthereumAddressResult>
  }
}
