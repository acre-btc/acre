import React from "react"
import FeaturedMetricsCard, {
  FeaturedMetricsCardProps,
} from "#/components/shared/FeaturedMetricsCard"
import { IconGift } from "@tabler/icons-react"

type RewardsEarnedCardProps = Omit<
  FeaturedMetricsCardProps,
  "label" | "icon" | "value" | "infoContent"
>

function RewardsEarnedCard(props: RewardsEarnedCardProps) {
  return (
    <FeaturedMetricsCard
      icon={IconGift}
      label="Rewards Earned"
      infoContent="Total rewards earned in Acre"
      value={["0.0002 BTC", "$482.90"]}
      {...props}
    />
  )
}

export default RewardsEarnedCard
