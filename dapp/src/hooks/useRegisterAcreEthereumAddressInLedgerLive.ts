import { useEffect } from "react"
import useIsEmbed from "./useIsEmbed"
import { useBitcoinProvider } from "./orangeKit"

const useRegisterAcreEthereumAddressInLedgerLive = () => {
  const { embeddedApp } = useIsEmbed()
  const bitcoinProvider = useBitcoinProvider()

  useEffect(() => {
    const handle = async () => {
      if (
        embeddedApp === "ledger-live" &&
        bitcoinProvider &&
        "registerYieldBearingEthereumAddress" in bitcoinProvider
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result =
          // @ts-expect-error WIP draft
          await bitcoinProvider.registerYieldBearingEthereumAddress({})
        // eslint-disable-next-line no-console
        console.log(result)
      }
    }

    // eslint-disable-next-line no-void
    void handle()
  }, [bitcoinProvider, embeddedApp])
}

export default useRegisterAcreEthereumAddressInLedgerLive
