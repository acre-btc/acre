import TbtcIcon from "../assets/icons/TbtcIcon"
import externalHref from "./externalHref"

const VAULT_PROVIDERS = {
  tbtc: {
    label: "Market-Neutral BTCFi Vault",
    icon: TbtcIcon,
    // TODO: Replace with actual description
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    // TODO: Replace with actual address
    address: "0x000000000",
    depositToken: "tBTC",
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
