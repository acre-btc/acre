import React from "react"
import { ListItem, Text } from "@chakra-ui/react"
import CurrencyBalance, {
  CurrencyBalanceProps,
} from "#/components/CurrencyBalance"
import { currencies } from "#/constants"

type FeesItemType = CurrencyBalanceProps & {
  label: string
}

export default function FeesTooltipItem({
  label,
  amount,
  ...props
}: FeesItemType) {
  return (
    <ListItem display="flex" justifyContent="space-between">
      <Text size="sm" color="white">
        {label}
      </Text>
      <CurrencyBalance
        size="sm"
        amount={amount}
        color="surface.4"
        fontWeight="semibold"
        desiredDecimals={currencies.DESIRED_DECIMALS_FOR_FEE}
        withRoundUp
        {...props}
      />
    </ListItem>
  )
}
