import React, { ComponentProps } from "react"
import { Flex } from "@chakra-ui/react"
import FeesDetailsItem, { FeesDetailsItemProps } from "."
import CurrencyBalanceWithConversion from "../CurrencyBalanceWithConversion"

type FeesDetailsItemAmountItemProps = ComponentProps<
  typeof CurrencyBalanceWithConversion
> &
  Pick<FeesDetailsItemProps, "label" | "tooltip">

function FeesDetailsAmountItem({
  label,
  tooltip,
  from,
  to,
}: FeesDetailsItemAmountItemProps) {
  return (
    <FeesDetailsItem label={label} tooltip={tooltip} alignItems="start">
      <Flex flexDirection="column" alignItems="end">
        <CurrencyBalanceWithConversion
          from={{
            size: "md",
            ...from,
          }}
          to={{
            size: "sm",
            fontWeight: "medium",
            color: "text.tertiary",
            ...to,
          }}
        />
      </Flex>
    </FeesDetailsItem>
  )
}

export default FeesDetailsAmountItem
