import TbtcIcon from "../assets/icons/TbtcIcon"
import externalHref from "./externalHref"

const VAULT_PROVIDERS = {
  tbtc: {
    label: "tBTC Allocator Vault",
    icon: TbtcIcon,
    address: "0x6A6092d9c47A7E4C085f2ED9FD4a376124587Ae0",
    depositToken: "tBTC",
  },
}

const VAULT_CURATORS = {
  midas: {
    label: "Midas",
    url: externalHref.MIDAS,
  },
}

export default {
  VAULT_PROVIDERS,
  VAULT_CURATORS,
}
