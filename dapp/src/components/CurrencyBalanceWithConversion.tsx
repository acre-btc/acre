import React from "react"
import { useCurrencyConversion } from "#/hooks"
import CurrencyBalance, { CurrencyBalanceProps } from "./CurrencyBalance"

export default function CurrencyBalanceWithConversion({
  from,
  to,
}: {
  from: CurrencyBalanceProps
  to: CurrencyBalanceProps
}) {
  const conversionAmount = useCurrencyConversion({ from, to })

  return (
    <>
      <CurrencyBalance {...from} />
      <CurrencyBalance
        amount={conversionAmount}
        shouldBeFormatted={false}
        {...to}
      />
    </>
  )
}
