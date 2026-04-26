import React, { useCallback, useMemo, useState } from "react"
import { Acre, AcreBitcoinProvider } from "@acre-btc/sdk"
import { chains, env } from "#/constants"

const { TBTC_API_ENDPOINT, SUBGRAPH_API_KEY, RELAYER_URL } = env
const ETH_RPC_URL = env.ETH_HOSTNAME_HTTP

type AcreSdkContextValue = {
  acre?: Acre
  init: (bitcoinProvider?: AcreBitcoinProvider) => Promise<void>
  isInitialized: boolean
  isConnected: boolean
}

export const AcreSdkContext = React.createContext<AcreSdkContextValue>({
  acre: undefined,
  init: async () => {},
  isInitialized: false,
  isConnected: false,
})

export function AcreSdkProvider({ children }: { children: React.ReactNode }) {
  const [acre, setAcre] = useState<Acre>()
  const [isInitialized, setIsInitialized] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  const init = useCallback<AcreSdkContextValue["init"]>(
    async (bitcoinProvider?: AcreBitcoinProvider) => {
      let sdk = await Acre.initialize(
        chains.BITCOIN_NETWORK,
        TBTC_API_ENDPOINT,
        ETH_RPC_URL,
        RELAYER_URL,
        SUBGRAPH_API_KEY,
      )

      if (bitcoinProvider) {
        setIsConnected(false)
        sdk = await sdk.connect(bitcoinProvider)
        setIsConnected(true)
      } else {
        setIsConnected(false)
      }

      setAcre(sdk)
      setIsInitialized(true)
    },
    [],
  )

  const context = useMemo(
    () => ({
      acre,
      init,
      isInitialized,
      isConnected,
    }),
    [init, acre, isInitialized, isConnected],
  )

  return (
    <AcreSdkContext.Provider value={context}>
      {children}
    </AcreSdkContext.Provider>
  )
}
