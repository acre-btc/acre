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
      label="APR (Est.)"
      infoContent="Estimated annual percentage rate for your deposits"
      // TODO: Do we want to display `Last 7 days...` APR?
      value={["9.0%", "Last 7 days 9%"]}
      {...props}
    />
  )
}

export default EstimatedAPRCard
