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
      label="Rewards Earned"
      infoContent="Total rewards earned in Acre"
      {...props}
    />
  )
}

export default RewardsEarnedCard
