import useAccountChangedOKX from "./orangeKit/useAccountChangedOKX"
import useAccountsChangedUnisat from "./orangeKit/useAccountsChangedUnisat"
import useAccountsChangedOKX from "./orangeKit/useAccountsChangedOKX"
import { useInitDataFromSdk, useInitializeAcreSdk } from "./sdk"
import useDetectEmbed from "./useDetectEmbed"
import useFetchBTCPriceUSD from "./useFetchBTCPriceUSD"
import useDisconnectWallet from "./useDisconnectWallet"
import useSentry from "./useSentry"
import useRegisterAcreEthereumAddressInLedgerLive from "./useRegisterAcreEthereumAddressInLedgerLive"

export default function useInitApp() {
  // TODO: Let's uncomment when dark mode is ready
  // useDetectThemeMode()
  useSentry()
  useDetectEmbed()
  useInitializeAcreSdk()
  useInitDataFromSdk()
  useFetchBTCPriceUSD()
  useDisconnectWallet()
  useAccountChangedOKX()
  useAccountsChangedOKX()
  useAccountsChangedUnisat()
  useRegisterAcreEthereumAddressInLedgerLive()
}
