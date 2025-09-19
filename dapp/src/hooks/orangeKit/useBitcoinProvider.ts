import { useMemo } from "react"
import { OrangeKitBitcoinWalletProvider } from "@orangekit/react/dist/src/wallet/bitcoin-wallet-provider"
import useConnector from "./useConnector"

export default function useBitcoinProvider<
  P = OrangeKitBitcoinWalletProvider,
>(): P | undefined {
  const connector = useConnector()

  return useMemo(() => {
    if (
      !connector ||
      !connector.getBitcoinProvider ||
      typeof connector.getBitcoinProvider !== "function"
    ) {
      return undefined
    }

    return connector.getBitcoinProvider() as OrangeKitBitcoinWalletProvider & P
  }, [connector])
}
