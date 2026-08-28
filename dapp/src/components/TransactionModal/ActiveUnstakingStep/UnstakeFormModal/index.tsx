import React from "react"
import { BaseFormProps, PROCESS_STATUSES } from "#/types"
import {
  useActionFlowStatus,
  useBitcoinPosition,
  useMinWithdrawAmount,
  useWallet,
} from "#/hooks"
import { numbersUtils, currencyUtils } from "#/utils"
import UnstakeForm from "./UnstakeForm"
import { UnstakeFormValues } from "./UnstakeFormBase"

function UnstakeFormModal({ onSubmitForm }: BaseFormProps<UnstakeFormValues>) {
  const { data } = useBitcoinPosition()
  const balance = data?.estimatedBitcoinBalance ?? 0n
  const minTokenAmount = useMinWithdrawAmount()
  const status = useActionFlowStatus()
  const { ethAddress } = useWallet()

  const { decimals } = currencyUtils.getCurrencyByType("bitcoin")
  const inputPlaceholder = `Minimum ${numbersUtils.fixedPointNumberToString(minTokenAmount, decimals)} BTC`
  const tokenAmountLabel = "Your deposit"
  const defaultAmount =
    status === PROCESS_STATUSES.REFINE_AMOUNT ? balance : undefined

  return (
    <UnstakeForm
      tokenBalanceInputPlaceholder={inputPlaceholder}
      tokenAmountLabel={tokenAmountLabel}
      currency="bitcoin"
      tokenBalance={balance}
      minTokenAmount={minTokenAmount}
      accountEvmAddress={ethAddress}
      onSubmitForm={onSubmitForm}
      withMaxButton
      defaultAmount={defaultAmount}
    />
  )
}

export default UnstakeFormModal
