import React from "react"
import { IconCurrencyBitcoin } from "@tabler/icons-react"
import BitcoinAmountFeaturedMetricsCard, {
  BitcoinAmountFeaturedMetricsCardProps,
} from "#/components/shared/BitcoinAmountFeaturedMetricsCard"

type BTCDepositedCardProps = Omit<
  BitcoinAmountFeaturedMetricsCardProps,
  "label" | "icon" | "infoContent"
>

function BTCDepositedCard(props: BTCDepositedCardProps) {
  return (
    <BitcoinAmountFeaturedMetricsCard
      icon={IconCurrencyBitcoin}
      label="Current Balance"
      infoContent="Total BTC deposited in Acre"
      {...props}
    />
  )
}

export default BTCDepositedCard
