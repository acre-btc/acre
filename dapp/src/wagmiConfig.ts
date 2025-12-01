import { http, createConfig, CreateConnectorFn } from "wagmi"
import { Chain, mainnet, sepolia } from "wagmi/chains"
import { CreateOrangeKitConnectorFn } from "@orangekit/react/dist/src/wallet/connector"
import { env } from "./constants"
import { getLastUsedBtcAddress } from "./hooks/useLastUsedBtcAddress"
import referralProgram, { EmbedApp } from "./utils/referralProgram"
import { orangeKit } from "./utils"
import { AcreLedgerLiveBitcoinProviderOptions } from "./utils/orangekit/ledger-live/bitcoin-provider"

const isTestnet = env.USE_TESTNET
const CHAIN_ID = isTestnet ? sepolia.id : mainnet.id

const chains: [Chain, ...Chain[]] = isTestnet ? [sepolia] : [mainnet]
const connectorConfig = {
  rpcUrl: env.ETH_HOSTNAME_HTTP,
  chainId: CHAIN_ID,
  relayApiKey: env.GELATO_RELAY_API_KEY,
}
const transports = chains.reduce(
  (acc, { id }) => ({ ...acc, [id]: http(env.ETH_HOSTNAME_HTTP) }),
  {},
)

async function getWagmiConfig() {
  const {
    getOrangeKitUnisatConnector,
    getOrangeKitOKXConnector,
    getOrangeKitXverseConnector,
  } = await import("@orangekit/react")

  const orangeKitUnisatConnector = getOrangeKitUnisatConnector(connectorConfig)
  const orangeKitOKXConnector = getOrangeKitOKXConnector(connectorConfig)
  const orangeKitXverseConnector = getOrangeKitXverseConnector(connectorConfig)

  let createEmbedConnectorFn
  const embeddedApp = referralProgram.getEmbeddedApp()
  if (referralProgram.isEmbedApp(embeddedApp)) {
    const lastUsedBtcAddress = getLastUsedBtcAddress()
    const xpub = orangeKit.findXpubFromUrl(window.location.href)
    const ledgerLiveConnectorOptions: AcreLedgerLiveBitcoinProviderOptions =
      xpub
        ? { tryConnectToAccountByXpub: xpub }
        : {
            tryConnectToAddress: lastUsedBtcAddress,
          }

    const orangeKitLedgerLiveConnector =
      orangeKit.getOrangeKitLedgerLiveConnector({
        ...connectorConfig,
        options: ledgerLiveConnectorOptions,
      })

    const embedConnectorsMap: Record<
      EmbedApp,
      () => CreateOrangeKitConnectorFn
    > = {
      "ledger-live": orangeKitLedgerLiveConnector,
    }

    createEmbedConnectorFn = embedConnectorsMap[embeddedApp as EmbedApp]
  }

  const defaultConnectors = [
    orangeKitXverseConnector(),
    orangeKitUnisatConnector(),
    orangeKitOKXConnector(),
  ]

  const connectors = (createEmbedConnectorFn !== undefined
    ? [createEmbedConnectorFn()]
    : defaultConnectors) as unknown as CreateConnectorFn[]

  return createConfig({
    chains,
    multiInjectedProviderDiscovery: false,
    connectors,
    transports,
  })
}

export default getWagmiConfig
