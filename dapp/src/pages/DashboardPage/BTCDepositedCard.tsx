import React from "react"
import FeaturedMetricsCard, {
  FeaturedMetricsCardProps,
} from "#/components/shared/FeaturedMetricsCard"
import { IconCurrencyBitcoin } from "@tabler/icons-react"

type BTCDepositedCardProps = Omit<
  FeaturedMetricsCardProps,
  "label" | "icon" | "value" | "infoContent"
>

function BTCDepositedCard(props: BTCDepositedCardProps) {
  return (
    <FeaturedMetricsCard
      icon={IconCurrencyBitcoin}
      label="BTC Deposited"
      infoContent="Total BTC deposited in Acre"
      value={["0.4800 BTC", "$49,871.29"]}
      {...props}
    />
  )
}

export default BTCDepositedCard
