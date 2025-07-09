import StarknetIcon from "../assets/icons/StarknetIcon"
import externalHref from "./externalHref"

const VAULT_PROVIDERS = {
  starknet: {
    label: "Starknet Staking",
    icon: StarknetIcon,
  },
}

const VAULT_CURATORS = {
  august: {
    label: "August",
    url: externalHref.AUGUST,
  },
}

export default {
  VAULT_PROVIDERS,
  VAULT_CURATORS,
}
