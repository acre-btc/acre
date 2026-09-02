import React, { useRef, useState } from "react"
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
  const { decimals, symbol } = currencyUtils.getCurrencyByType(currency)

  const valueRef = useRef<bigint | undefined>(amount)
  // Local state holds only what the user has typed, because an in-progress
  // value like "0." has no faithful `bigint` to round-trip through. Until they
  // type, the field renders `amount` straight from its owner, so a value that
  // changes underneath - a balance that refetches, say - is still picked up.
  const [typedValue, setTypedValue] = useState<string | undefined>(undefined)
  const displayedValue =
    typedValue ??
    (amount !== undefined
      ? numbersUtils.fixedPointNumberToString(amount, decimals)
      : undefined)
  const styles = useMultiStyleConfig("TokenBalanceInput", { size })

  const onValueChange = (values: NumberFormatInputValues) => {
    const { value } = values

    valueRef.current = value
      ? numbersUtils.userAmountToBigInt(value, decimals)
      : undefined
    setTypedValue(value)
  }

  const onChange = () => {
    setAmount(valueRef.current)
  }

  const onClickMaxButton = () => {
    setAmount(tokenBalance)
    setTypedValue(numbersUtils.fixedPointNumberToString(tokenBalance, decimals))
  }

  const isBalanceExceeded =
    typeof errorMsgText === "string" &&
    forms.isFormError("EXCEEDED_VALUE", errorMsgText)

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
