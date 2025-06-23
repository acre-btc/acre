import React from "react"
import { useFormField } from "#/hooks"
import TokenBalanceInput, { TokenBalanceInputProps } from "../TokenBalanceInput"

export type FormTokenBalanceInputProps = {
  name: string
} & Omit<TokenBalanceInputProps, "setAmount">

export function FormTokenBalanceInput({
  name,
  ...restProps
}: FormTokenBalanceInputProps) {
  const { field, value, errorMsgText, hasError, onChange } = useFormField<
    bigint | undefined
  >(name)

  return (
    <TokenBalanceInput
      {...restProps}
      {...field}
      amount={value}
      setAmount={onChange}
      hasError={hasError}
      errorMsgText={errorMsgText}
    />
  )
}
