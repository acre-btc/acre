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

/**
 * Waits for the Xverse wallet provider to become available.
 * Xverse 2.0+ injects its provider asynchronously and announces readiness via
 * the `bitcoin:providers` window event (SatsConnect v2 standard). Without this
 * wait, `getOrangeKitXverseConnector` captures `undefined` and the wallet
 * permanently appears as "not installed".
 */
function waitForXverseProvider(timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (window.XverseProviders?.BitcoinProvider) {
      resolve()
      return
    }

    let settled = false

    const onProvider = () => {
      if (window.XverseProviders?.BitcoinProvider) {
        settled = true
        clearTimeout(timer) // eslint-disable-line @typescript-eslint/no-use-before-define
        window.removeEventListener("bitcoin:providers", onProvider)
        resolve()
      }
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        window.removeEventListener("bitcoin:providers", onProvider)
        resolve() // Resolve even on timeout — wallet may not be installed
      }
    }, timeoutMs)

    window.addEventListener("bitcoin:providers", onProvider)
  })
}

async function getWagmiConfig() {
  // Wait for async wallet provider injection (Xverse 2.0+) before creating
  // connectors. The app shows a splash screen during this time.
  await waitForXverseProvider()

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
