import React, { useCallback } from "react"
import {
  Box,
  useMultiStyleConfig,
  TextProps,
  ResponsiveValue,
} from "@chakra-ui/react"
import { numbersUtils, currencyUtils } from "#/utils"
import { CurrencyType, AmountType } from "#/types"
import Tooltip from "./Tooltip"

export type CurrencyBalanceProps = {
  currency: CurrencyType
  amount?: AmountType
  shouldBeFormatted?: boolean
  withRoundUp?: boolean
  desiredDecimals?: number
  size?: ResponsiveValue<string>
  variant?: ResponsiveValue<
    | "greater-balance-md"
    | "greater-balance-xl"
    | "greater-balance-xxl"
    | "unstyled"
  >
  symbolPosition?: "prefix" | "suffix"
  withDots?: boolean
  balanceTextProps?: TextProps
  symbolTextProps?: TextProps
  withTooltip?: boolean
} & TextProps

export default function CurrencyBalance({
  currency,
  amount,
  shouldBeFormatted = true,
  withRoundUp = false,
  desiredDecimals: customDesiredDecimals,
  size,
  variant,
  symbolPosition = "suffix",
  withDots = false,
  as,
  balanceTextProps,
  symbolTextProps,
  withTooltip = false,
  ...textProps
}: CurrencyBalanceProps) {
  const styles = useMultiStyleConfig("CurrencyBalance", {
    size,
    variant,
    symbolPosition,
  })

  const {
    symbol,
    decimals,
    desiredDecimals: currencyDesiredDecimals,
  } = currencyUtils.getCurrencyByType(currency)
  const desiredDecimals = customDesiredDecimals ?? currencyDesiredDecimals

  const getBalance = useCallback(
    (options: { withFullPrecision?: boolean } = {}) => {
      const { withFullPrecision } = options

      const value = amount ?? 0n

      if (shouldBeFormatted || typeof value === "bigint") {
        if (withFullPrecision)
          return numbersUtils.fixedPointNumberToString(
            BigInt(value),
            decimals,
            withRoundUp,
          )

        return numbersUtils.formatTokenAmount(
          value,
          decimals,
          desiredDecimals,
          withRoundUp,
        )
      }

      return numbersUtils.numberToLocaleString(
        value.toString(),
        desiredDecimals,
      )
    },
    [amount, decimals, desiredDecimals, shouldBeFormatted, withRoundUp],
  )

  const content = (
    <Box as={as} __css={styles.container}>
      <Box
        as="span"
        __css={styles.balance}
        {...textProps}
        {...balanceTextProps}
      >
        {getBalance()}
        {withDots && "..."}
      </Box>
      <Box as="span" __css={styles.symbol} {...textProps} {...symbolTextProps}>
        {symbol}
      </Box>
    </Box>
  )

  if (withTooltip) {
    const tooltipLabel = `${getBalance({ withFullPrecision: true })} ${symbol}`

    return (
      <Tooltip size="xs" label={tooltipLabel} shouldWrapChildren>
        {content}
      </Tooltip>
    )
  }

  return content
}
