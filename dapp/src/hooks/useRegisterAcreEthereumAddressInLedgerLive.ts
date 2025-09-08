import AcreLedgerLiveBitcoinProvider from "#/utils/orangekit/ledger-live/bitcoin-provider"
import { useQuery } from "@tanstack/react-query"
import useIsEmbed from "./useIsEmbed"
import { useBitcoinProvider } from "./orangeKit"
import useWallet from "./useWallet"

const useRegisterAcreEthereumAddressInLedgerLive = () => {
  const { embeddedApp } = useIsEmbed()
  const bitcoinProvider = useBitcoinProvider<AcreLedgerLiveBitcoinProvider>()
  const { ethAddress } = useWallet()

  return useQuery({
    queryKey: ["registerAcreEthereumAddressInLedgerLive", ethAddress],
    enabled: embeddedApp === "ledger-live" && !!bitcoinProvider,
    queryFn: async () => {
      if (!bitcoinProvider || !ethAddress)
        throw new Error("Cannot register Ethereum address in Ledger Live")

      return bitcoinProvider.registerYieldBearingEthereumAddress({
        ethereumAddress: ethAddress,
      })
    },
  })
}

export default useRegisterAcreEthereumAddressInLedgerLive
