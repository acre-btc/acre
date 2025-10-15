import React from "react"
import FeaturedMetricsCard, {
  FeaturedMetricsCardProps,
} from "#/components/shared/FeaturedMetricsCard"
import { useCurrencyConversion } from "#/hooks"
import { numbersUtils } from "#/utils"

export type BitcoinAmountFeaturedMetricsCardProps = Omit<
  FeaturedMetricsCardProps,
  "value"
> & { btcAmount?: bigint }

function BitcoinAmountFeaturedMetricsCard({
  btcAmount,
  ...props
}: BitcoinAmountFeaturedMetricsCardProps) {
  const convertedAmount = useCurrencyConversion({
    from: { currency: "bitcoin", amount: btcAmount },
    to: { currency: "usd" },
  })

  return (
    <FeaturedMetricsCard
      {...props}
      value={[
        `${numbersUtils.formatSatoshiAmount(btcAmount ?? 0n, 4)} BTC`,
        `$${numbersUtils.numberToLocaleString(convertedAmount ?? 0, 2)}`,
      ]}
    />
  )
}

export default BitcoinAmountFeaturedMetricsCard
