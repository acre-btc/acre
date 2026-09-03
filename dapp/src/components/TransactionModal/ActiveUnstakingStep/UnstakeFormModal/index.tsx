import React from "react"
import { BaseFormProps } from "#/types"
import { useBitcoinPosition, useMinWithdrawAmount, useWallet } from "#/hooks"
import UnstakeForm from "./UnstakeForm"
import { UnstakeFormValues } from "./UnstakeFormBase"

function UnstakeFormModal({ onSubmitForm }: BaseFormProps<UnstakeFormValues>) {
  const { data } = useBitcoinPosition()
  const balance = data?.estimatedBitcoinBalance ?? 0n
  const minTokenAmount = useMinWithdrawAmount()
  const { ethAddress } = useWallet()

  return (
    <UnstakeForm
      tokenAmountLabel="Your deposit"
      currency="bitcoin"
      tokenBalance={balance}
      minTokenAmount={minTokenAmount}
      accountEvmAddress={ethAddress}
      onSubmitForm={onSubmitForm}
    />
  )
}

export default UnstakeFormModal
