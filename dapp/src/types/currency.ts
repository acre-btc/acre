export type Currency = {
  name: string
  symbol: string
  decimals: number
  desiredDecimals: number
}

export type CurrencyType = "bitcoin" | "usd" | "acrebtc"

export type AmountType = string | number | bigint
