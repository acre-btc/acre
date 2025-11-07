import React from "react"
import { IconGift } from "@tabler/icons-react"
import BitcoinAmountFeaturedMetricsCard, {
  BitcoinAmountFeaturedMetricsCardProps,
} from "#/components/shared/BitcoinAmountFeaturedMetricsCard"

type RewardsEarnedCardProps = Omit<
  BitcoinAmountFeaturedMetricsCardProps,
  "label" | "icon" | "infoContent"
>

function RewardsEarnedCard(props: RewardsEarnedCardProps) {
  return (
    <BitcoinAmountFeaturedMetricsCard
      icon={IconGift}
      label="BTC Earned"
      infoContent="Total BTC rewards earned in Acre. Does NOT include Acre Points or Acre v1 Rewards)"
      {...props}
    />
  )
}

export default RewardsEarnedCard
