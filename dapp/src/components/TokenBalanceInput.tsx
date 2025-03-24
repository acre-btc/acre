import React, { useEffect, useRef, useState } from "react"
import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  InputGroup,
  InputProps,
  InputRightElement,
  useMultiStyleConfig,
} from "@chakra-ui/react"
import { numbersUtils, currencyUtils, forms } from "#/utils"
import { CurrencyType } from "#/types"
import { useCurrencyConversion } from "#/hooks"
import NumberFormatInput, {
  NumberFormatInputValues,
  NumberFormatInputProps,
} from "./NumberFormatInput"
import CurrencyBalance from "./CurrencyBalance"
import HelperErrorText, { HelperErrorTextProps } from "./Form/HelperErrorText"

type FiatCurrencyBalanceProps = {
  amount: bigint
  currency: CurrencyType
  fiatCurrency: CurrencyType
}

function FiatCurrencyBalance({
  amount,
  currency,
  fiatCurrency,
}: FiatCurrencyBalanceProps) {
  const styles = useMultiStyleConfig("Form")
  const { fontWeight } = styles.helperText

  const fiatAmount = useCurrencyConversion({
    from: { amount, currency },
    to: { currency: fiatCurrency },
  })

  if (fiatAmount !== undefined) {
    return (
      <CurrencyBalance
        currency={fiatCurrency}
        amount={fiatAmount}
        shouldBeFormatted={false}
        fontWeight={fontWeight as string}
        size="sm"
      />
    )
  }

  return null
}

export type TokenBalanceInputProps = {
  amount?: bigint
  defaultAmount?: bigint
  currency: CurrencyType
  tokenBalance: bigint
  placeholder?: string
  size?: "lg" | "md"
  fiatCurrency?: CurrencyType
  setAmount: (value?: bigint) => void
  withMaxButton?: boolean
  tokenAmountLabel?: string
} & Omit<InputProps, "isInvalid" | "value" | "onValueChange" | "onChange"> &
  HelperErrorTextProps &
  Pick<NumberFormatInputProps, "decimalScale">

export default function TokenBalanceInput({
  amount,
  defaultAmount,
  currency,
  tokenBalance,
  placeholder,
  size = "lg",
  setAmount,
  errorMsgText,
  helperText,
  hasError = false,
  fiatCurrency,
  withMaxButton = false,
  tokenAmountLabel = "Amount",
  ...inputProps
}: TokenBalanceInputProps) {
  const valueRef = useRef<bigint | undefined>(amount)
  const [displayedValue, setDisplayedValue] = useState<string | undefined>()
  const styles = useMultiStyleConfig("TokenBalanceInput", { size })

  const { decimals, symbol } = currencyUtils.getCurrencyByType(currency)

  const onValueChange = (values: NumberFormatInputValues) => {
    const { value } = values

    valueRef.current = value
      ? numbersUtils.userAmountToBigInt(value, decimals)
      : undefined
    setDisplayedValue(value)
  }

  const onChange = () => {
    setAmount(valueRef.current)
  }

  const onClickMaxButton = () => {
    setAmount(tokenBalance)
    setDisplayedValue(
      numbersUtils.fixedPointNumberToString(tokenBalance, decimals),
    )
  }

  const isBalanceExceeded =
    typeof errorMsgText === "string" &&
    forms.isFormError("EXCEEDED_VALUE", errorMsgText)

  const defaultValue = defaultAmount
    ? numbersUtils.fixedPointNumberToString(defaultAmount, decimals)
    : undefined

  useEffect(() => {
    if (!defaultAmount) return

    setAmount(defaultAmount)
  }, [defaultAmount, setAmount])

  return (
    <FormControl isInvalid={hasError} isDisabled={inputProps.isDisabled}>
      <FormLabel htmlFor={inputProps.name} size={size} mr={0}>
        <Box __css={styles.labelContainer}>
          Amount
          <Box __css={styles.balanceContainer}>
            <Box as="span" __css={styles.balance}>
              {tokenAmountLabel}
            </Box>
            <CurrencyBalance
              color={isBalanceExceeded ? "red.50" : "text.primary"}
              size={size === "lg" ? "md" : "sm"}
              amount={tokenBalance}
              currency={currency}
            />
          </Box>
        </Box>
      </FormLabel>
      <InputGroup>
        <NumberFormatInput
          variant="outline"
          size={size}
          suffix={` ${symbol}`}
          placeholder={placeholder}
          integerScale={10}
          decimalScale={decimals}
          allowNegative={false}
          {...inputProps}
          isInvalid={hasError}
          value={displayedValue}
          defaultValue={defaultValue}
          onValueChange={onValueChange}
          onChange={onChange}
        />

        {withMaxButton && (
          <InputRightElement>
            <Button h="70%" onClick={onClickMaxButton}>
              Max
            </Button>
          </InputRightElement>
        )}
      </InputGroup>
      <HelperErrorText
        helperText={helperText}
        errorMsgText={errorMsgText}
        hasError={hasError}
      />
      {!hasError && !helperText && !!fiatCurrency && (
        <FormHelperText>
          <FiatCurrencyBalance
            amount={amount ?? 0n}
            currency={currency}
            fiatCurrency={fiatCurrency}
          />
        </FormHelperText>
      )}
    </FormControl>
  )
}
