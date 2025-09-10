import { Currency, CurrencyType } from "#/types"
import env from "./env"

const DESIRED_DECIMALS_FOR_FEE = 5

const BITCOIN: Currency = {
  name: "Bitcoin",
  symbol: "BTC",
  decimals: 8,
  // TODO: Change when min amount of BTC will be updated
  desiredDecimals: 4,
}

const ACREBTC: Currency = {
  ...BITCOIN,
  name: "acreBTC",
  symbol: "acreBTC",
  decimals: 18,
  desiredDecimals: 4,
}

const USD: Currency = {
  name: "United States Dollar",
  symbol: "USD",
  decimals: 10,
  desiredDecimals: 2,
}

const CURRENCY_ID_BITCOIN = env.USE_TESTNET ? "bitcoin_testnet" : "bitcoin"

const CURRENCIES_BY_TYPE: Record<CurrencyType, Currency> = {
  bitcoin: BITCOIN,
  usd: USD,
  acrebtc: ACREBTC,
}

export default {
  BITCOIN,
  ACREBTC,
  USD,
  CURRENCY_ID_BITCOIN,
  CURRENCIES_BY_TYPE,
  DESIRED_DECIMALS_FOR_FEE,
}
