import TbtcIcon from "../assets/icons/TbtcIcon"
import externalHref from "./externalHref"

const VAULT_PROVIDERS = {
  tbtc: {
    label: "Market-Neutral BTCFi Vault",
    icon: TbtcIcon,
  },
}

const VAULT_CURATORS = {
  re7: {
    label: "Re7",
    url: externalHref.RE7,
  },
}

export default {
  VAULT_PROVIDERS,
  VAULT_CURATORS,
}
