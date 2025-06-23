import React from "react"
import TokenAmountForm from "#/components/TokenAmountForm"
import { TokenAmountFormValues } from "#/components/TokenAmountForm/TokenAmountFormBase"
import { useMinDepositAmount, useWallet } from "#/hooks"
import { ACTION_FLOW_TYPES, BaseFormProps } from "#/types"
import { numbersUtils, currencyUtils } from "#/utils"
import { featureFlags } from "#/constants"
import { FormSubmitButton } from "#/components/Form"
import StakeDetails from "./StakeDetails"
import AcrePointsRewardEstimation from "./AcrePointsRewardEstimation"
import ActionDurationEstimation from "../../ActionDurationEstimation"

function StakeFormModal({
  onSubmitForm,
}: BaseFormProps<TokenAmountFormValues>) {
  const minDepositAmount = useMinDepositAmount()
  const { balance: tokenBalance } = useWallet()

  const { decimals } = currencyUtils.getCurrencyByType("bitcoin")
  const inputPlaceholder = `Minimum ${numbersUtils.fixedPointNumberToString(minDepositAmount, decimals)} BTC`
  const tokenAmountLabel = "Wallet balance"

  return (
    <TokenAmountForm
      actionType={ACTION_FLOW_TYPES.STAKE}
      tokenBalanceInputPlaceholder={inputPlaceholder}
      tokenAmountLabel={tokenAmountLabel}
      currency="bitcoin"
      tokenBalance={tokenBalance ?? 0n}
      minTokenAmount={minDepositAmount}
      onSubmitForm={onSubmitForm}
      withMaxButton={false}
    >
      {featureFlags.ACRE_POINTS_ENABLED && (
        <AcrePointsRewardEstimation mt={5} />
      )}
      <StakeDetails currency="bitcoin" />
      <FormSubmitButton mt={10}>Deposit</FormSubmitButton>
      <ActionDurationEstimation type="deposit" />
    </TokenAmountForm>
  )
}

export default StakeFormModal
