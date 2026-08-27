import React from "react"
import FeaturedMetricsCard, {
  FeaturedMetricsCardProps,
} from "#/components/shared/FeaturedMetricsCard"
import { IconTrendingUp } from "@tabler/icons-react"

type CurrentAPYCardProps = Omit<
  FeaturedMetricsCardProps,
  "label" | "icon" | "value" | "infoContent"
>

function CurrentAPYCard(props: CurrentAPYCardProps) {
  return (
    <FeaturedMetricsCard
      icon={IconTrendingUp}
      label="Current APY"
      infoContent="acreBTC is currently earning Acre Points only with the protocol upgrade and transition."
      value={["0%"]}
      {...props}
    />
  )
}

export default CurrentAPYCard
