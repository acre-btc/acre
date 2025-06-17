import React from "react"
import { Box, ListItem, Text } from "@chakra-ui/react"
import CurrencyBalance, {
  CurrencyBalanceProps,
} from "#/components/shared/CurrencyBalance"
import { currencies } from "#/constants"

type FeesItemProps = CurrencyBalanceProps & {
  label: string
  isReimbursable?: boolean
  reimbursableFeeLabel?: string
}
export default function FeesTooltipItem({
  label,
  amount,
  isReimbursable = false,
  reimbursableFeeLabel,
  ...props
}: FeesItemProps) {
  return (
    <ListItem display="flex" flexDirection="column">
      <Box display="flex" justifyContent="space-between">
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
          as={isReimbursable ? "s" : undefined}
          {...props}
        />
      </Box>

      {isReimbursable && (
        <>
          <Box marginLeft="auto" color="green.30">
            <CurrencyBalance
              currency="bitcoin"
              size="sm"
              amount={0}
              fontWeight="400"
              desiredDecimals={2}
              withRoundUp
            />
          </Box>
          <Box marginLeft="auto" color="green.30">
            <Text size="sm" color="brown.40">
              {reimbursableFeeLabel}
            </Text>
          </Box>
        </>
      )}
    </ListItem>
  )
}
