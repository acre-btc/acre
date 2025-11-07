import React from "react"
import FeaturedMetricsCard, {
  FeaturedMetricsCardProps,
} from "#/components/shared/FeaturedMetricsCard"
import { IconTrendingUp } from "@tabler/icons-react"

type EstimatedAPRCardProps = Omit<
  FeaturedMetricsCardProps,
  "label" | "icon" | "value" | "infoContent"
>

function EstimatedAPRCard(props: EstimatedAPRCardProps) {
  return (
    <FeaturedMetricsCard
      icon={IconTrendingUp}
      label="Target APY"
      infoContent="Target APY is estimated on past performance. Live APY updated every 2 weeks."
      value={["14%"]}
      {...props}
    />
  )
}

export default EstimatedAPRCard
