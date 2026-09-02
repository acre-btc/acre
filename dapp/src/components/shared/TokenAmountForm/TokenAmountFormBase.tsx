import React from "react"
import { FormikProps } from "formik"
import { CurrencyType } from "#/types"
import { Form, FormTokenBalanceInput } from "../Form"

export const TOKEN_AMOUNT_FIELD_NAME = "amount"

export type TokenAmountFormValues = {
  [TOKEN_AMOUNT_FIELD_NAME]?: bigint
}

export type TokenAmountFormBaseProps = {
  formId?: string
  tokenBalance: bigint
  tokenBalanceInputPlaceholder: string
  tokenAmountLabel?: string
  currency: CurrencyType
  withMaxButton: boolean
  children?: React.ReactNode
}

export default function TokenAmountFormBase({
  formId,
  tokenBalance,
  currency,
  tokenBalanceInputPlaceholder,
  tokenAmountLabel,
  withMaxButton,
  children,
  ...formikProps
}: TokenAmountFormBaseProps & FormikProps<TokenAmountFormValues>) {
  return (
    <Form id={formId} onSubmit={formikProps.handleSubmit}>
      <FormTokenBalanceInput
        name={TOKEN_AMOUNT_FIELD_NAME}
        tokenBalance={tokenBalance}
        placeholder={tokenBalanceInputPlaceholder}
        tokenAmountLabel={tokenAmountLabel}
        currency={currency}
        withMaxButton={withMaxButton}
        autoFocus
        autoComplete="off"
      />
      {children}
    </Form>
  )
}
