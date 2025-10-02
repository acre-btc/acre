import AcreLedgerLiveBitcoinProvider from "#/utils/orangekit/ledger-live/bitcoin-provider"
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { env, queryKeysFactory } from "#/constants"
import useIsEmbed from "./useIsEmbed"
import { useBitcoinProvider } from "./orangeKit"
import useWallet from "./useWallet"
import useActivities from "./useActivities"

const ACRE_BTC_CONTRACT_ADDRESS =
  env.NETWORK_TYPE === "mainnet"
    ? "0x19531C886339dd28b9923d903F6B235C45396ded"
    : "0xB8ba4B007321e0EB4586De49E59593E0eD66d367"
const TOKEN_TICKER = env.NETWORK_TYPE === "mainnet" ? "acreBTC" : "tacreBTC"

const useRegisterAcreEthereumAddressInLedgerLive = () => {
  const { embeddedApp } = useIsEmbed()
  const bitcoinProvider = useBitcoinProvider<AcreLedgerLiveBitcoinProvider>()
  const { ethAddress } = useWallet()

  const { data, isLoading } = useActivities()

  const hasAnyDeposit = useMemo(() => {
    if (!data) return false

    return !!data.find((activity) => activity.type === "deposit")
  }, [data])

  return useQuery({
    queryKey: [...queryKeysFactory.userKeys.registerAcreToken(), ethAddress],
    enabled:
      embeddedApp === "ledger-live" &&
      !!bitcoinProvider &&
      !isLoading &&
      hasAnyDeposit,
    queryFn: async () => {
      if (!bitcoinProvider || !ethAddress)
        throw new Error("Cannot register Ethereum address in Ledger Live")

      return bitcoinProvider.registerYieldBearingEthereumAddress({
        ethereumAddress: ethAddress,
        tokenContractAddress: ACRE_BTC_CONTRACT_ADDRESS,
        tokenTicker: TOKEN_TICKER,
        meta: {
          protocol: "ACRE",
          apy: "4.8%",
        },
      })
    },
  })
}

export default useRegisterAcreEthereumAddressInLedgerLive
