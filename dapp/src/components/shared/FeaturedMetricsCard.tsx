import React from "react"
import {
  Card,
  CardBody,
  CardHeader,
  CardProps,
  Flex,
  Heading,
  Icon,
  Text,
} from "@chakra-ui/react"
import TooltipIcon from "#/components/shared/TooltipIcon"
import { TablerIcon } from "@tabler/icons-react"
import Skeleton from "./Skeleton"

export type FeaturedMetricsCardProps = Omit<CardProps, "children"> & {
  label: string
  icon: TablerIcon
  infoContent?: string
  value: [primary: string, secondary?: string]
  isLoading?: boolean
}

function FeaturedMetricsCard({
  isLoading,
  ...props
}: FeaturedMetricsCardProps) {
  const { label, icon: iconComponent, infoContent, value } = props
  const [primaryValue, secondaryValue] = value

  return (
    <Card>
      <CardHeader as={Flex} alignItems="center" gap={2} w="100%" mb={4}>
        <Icon
          as={iconComponent}
          boxSize={8}
          p={1.5}
          rounded="full"
          bg="surface.4"
        />

        <Heading size="md" flex={1}>
          {label}
        </Heading>

        {infoContent && <TooltipIcon label={infoContent} />}
      </CardHeader>

      <CardBody as={Flex} flexDirection="column" gap={1}>
        <Text size="2xl" as="div" fontWeight="semibold">
          {isLoading ? <Skeleton height="1em" /> : primaryValue}
        </Text>

        {secondaryValue && (
          <Text fontSize="sm" as="div" color="neutral.60">
            {isLoading ? <Skeleton height="1em" /> : secondaryValue}
          </Text>
        )}
      </CardBody>
    </Card>
  )
}

export default FeaturedMetricsCard
