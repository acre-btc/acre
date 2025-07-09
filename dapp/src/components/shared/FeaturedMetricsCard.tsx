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

export type FeaturedMetricsCardProps = Omit<CardProps, "children"> & {
  label: string
  icon: TablerIcon
  infoContent?: string
  value: [primary: string, secondary?: string]
}

function FeaturedMetricsCard(props: FeaturedMetricsCardProps) {
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
        <Text size="2xl" fontWeight="semibold">
          {primaryValue}
        </Text>

        {secondaryValue && (
          <Text fontSize="md" color="neutral.60">
            {secondaryValue}
          </Text>
        )}
      </CardBody>
    </Card>
  )
}

export default FeaturedMetricsCard
