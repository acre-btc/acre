import { GelatoTransactionSender, OrangeKitSdk } from "@orangekit/sdk"
import {
  getDefaultProvider,
  Provider as EthereumProvider,
  VoidSigner,
} from "ethers"
import {
  EthereumAddress,
  EthereumNetwork,
  getEthereumContracts,
} from "./lib/ethereum"
import Account from "./modules/account"
import Tbtc from "./modules/tbtc"
import { AcreBitcoinProvider, BitcoinNetwork } from "./lib/bitcoin"
import { getChainIdByNetwork } from "./lib/ethereum/network"
import AcreSubgraphApi from "./lib/api/AcreSubgraphApi"
import Protocol from "./modules/protocol"

/**
 * Acre SDK.
 */
class Acre {
  readonly #network: BitcoinNetwork

  readonly #tbtcApiUrl: string

  readonly #orangeKit: OrangeKitSdk

  readonly #ethereumProvider: EthereumProvider

  readonly #ethereumRpcURL: string

  readonly #acreSubgraph: AcreSubgraphApi

  #account: Account | undefined

  public readonly protocol: Protocol

  private constructor(
    bitcoinNetwork: BitcoinNetwork,
    ethereumProvider: EthereumProvider,
    orangeKit: OrangeKitSdk,
    tbtcApiUrl: string,
    acreSubgraphApi: AcreSubgraphApi,
    protocol: Protocol,
    ethereumRpcURL: string,
  ) {
    this.#network = bitcoinNetwork
    this.#ethereumProvider = ethereumProvider
    this.#tbtcApiUrl = tbtcApiUrl
    this.#orangeKit = orangeKit
    this.#acreSubgraph = acreSubgraphApi
    this.protocol = protocol
    this.#ethereumRpcURL = ethereumRpcURL
  }

  /**
   * Initialize Acre SDK.
   * @param network - Bitcoin network.
   * @param tbtcApiUrl - tBTC API URL.
   * @param ethereumRpcUrl - Ethereum RPC URL.
   * @param gelatoApiKey - Gelato API key.
   * @param subgraphApiKey - The subgraph API key.
   */
  static async initialize(
    network: BitcoinNetwork,
    tbtcApiUrl: string,
    ethereumRpcUrl: string,
    gelatoApiKey: string,
    subgraphApiKey: string,
  ) {
    const ethereumNetwork: EthereumNetwork =
      Acre.resolveEthereumNetwork(network)

    const ethereumChainId = getChainIdByNetwork(ethereumNetwork)
    const ethersProvider = getDefaultProvider(ethereumRpcUrl)

    const providerChainId = (await ethersProvider.getNetwork()).chainId
    if (ethereumChainId !== providerChainId) {
      throw new Error(
        `Invalid RPC node chain id. Provider chain id: ${providerChainId}; expected chain id: ${ethereumChainId}`,
      )
    }

    const orangeKit = await OrangeKitSdk.init(
      Number(ethereumChainId),
      ethereumRpcUrl,
      new GelatoTransactionSender(gelatoApiKey, {
        backoffRetrier: { retries: 7, backoffStepMs: 3000 },
      }),
    )

    const contracts = await getEthereumContracts(
      ethersProvider,
      ethereumNetwork,
    )

    const acreSubgraphApiUrl =
      network === BitcoinNetwork.Mainnet
        ? `https://gateway-arbitrum.network.thegraph.com/api/${subgraphApiKey}/subgraphs/id/DJfS9X5asHtFEdAPikBcSLw8jtKmFcbReQVEa2iY9C9`
        : "https://api.studio.thegraph.com/query/73600/acre-sepolia/version/latest"

    const subgraph = new AcreSubgraphApi(acreSubgraphApiUrl)

    const protocol = new Protocol(contracts)

    return new Acre(
      network,
      ethersProvider,
      orangeKit,
      tbtcApiUrl,
      subgraph,
      protocol,
      ethereumRpcUrl,
    )
  }

  /**
   * Connect the Acre SDK to a Bitcoin wallet.
   * @param bitcoinProvider Provider for Bitcoin wallet.
   * @returns Acre SDK instance with connected account.
   */
  async connect(bitcoinProvider: AcreBitcoinProvider): Promise<Acre> {
    const accountBitcoinAddress = await bitcoinProvider.getAddress()
    const accountBitcoinPublicKey = await bitcoinProvider.getPublicKey()
    const accountEthereumAddress = EthereumAddress.from(
      await this.#orangeKit.predictAddress(
        accountBitcoinAddress,
        accountBitcoinPublicKey,
      ),
    )

    const signer = new VoidSigner(
      `0x${accountEthereumAddress.identifierHex}`,
      this.#ethereumProvider,
    )

    const ethereumNetwork = Acre.resolveEthereumNetwork(this.#network)

    const contracts = await getEthereumContracts(signer, ethereumNetwork)

    const tbtc = await Tbtc.initialize(
      this.#network,
      this.#ethereumRpcURL,
      this.#tbtcApiUrl,
      contracts.bitcoinDepositor,
    )

    this.#account = new Account(
      contracts,
      tbtc,
      this.#acreSubgraph,
      {
        bitcoinAddress: accountBitcoinAddress,
        ethereumAddress: accountEthereumAddress,
        bitcoinPublicKey: accountBitcoinPublicKey,
      },
      bitcoinProvider,
      this.#orangeKit,
      this.#network,
    )

    return this
  }

  /**
   * Disconnect the Acre SDK from the Bitcoin wallet.
   */
  disconnect(): void {
    if (this.#account) {
      this.#account = undefined
    }
  }

  /**
   * Resolve ethereum network based on the Bitcoin network.
   * @param bitcoinNetwork Bitcoin network.
   * @returns Ethereum network associated with the Bitcoin network.
   */
  private static resolveEthereumNetwork(bitcoinNetwork: BitcoinNetwork) {
    return bitcoinNetwork === BitcoinNetwork.Testnet ? "sepolia" : "mainnet"
  }

  /**
   * Get the connected account. Requires calling the `connect` method first.
   */
  public get account(): Account {
    if (!this.#account) {
      throw new Error("Account is not initialized; call connect method first")
    }

    return this.#account
  }
}

// eslint-disable-next-line import/prefer-default-export
export { Acre }
