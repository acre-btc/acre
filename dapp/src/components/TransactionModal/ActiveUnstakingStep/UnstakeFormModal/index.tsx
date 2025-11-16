import React from "react"
import TokenAmountForm from "#/components/shared/TokenAmountForm"
import { TokenAmountFormValues } from "#/components/shared/TokenAmountForm/TokenAmountFormBase"
import { FormSubmitButton } from "#/components/shared/Form"
import { ACTION_FLOW_TYPES, BaseFormProps, PROCESS_STATUSES } from "#/types"
import {
  useActionFlowStatus,
  useBitcoinPosition,
  useMinWithdrawAmount,
} from "#/hooks"
import { numbersUtils, currencyUtils } from "#/utils"
import { Alert } from "#/components/shared/Alert"
import { AlertIcon, Text, AlertDescription } from "@chakra-ui/react"
import UnstakeDetails from "./UnstakeDetails"
import ActionDurationEstimation from "../../ActionDurationEstimation"

function UnstakeFormModal({
  onSubmitForm,
}: BaseFormProps<TokenAmountFormValues>) {
  const { data } = useBitcoinPosition()
  const balance = data?.estimatedBitcoinBalance ?? 0n
  const minTokenAmount = useMinWithdrawAmount()
  const status = useActionFlowStatus()

  const { decimals } = currencyUtils.getCurrencyByType("bitcoin")
  const inputPlaceholder = `Minimum ${numbersUtils.fixedPointNumberToString(minTokenAmount, decimals)} BTC`
  const tokenAmountLabel = "Your deposit"
  const defaultAmount =
    status === PROCESS_STATUSES.REFINE_AMOUNT ? balance : undefined

  return (
    <TokenAmountForm
      actionType={ACTION_FLOW_TYPES.UNSTAKE}
      tokenBalanceInputPlaceholder={inputPlaceholder}
      tokenAmountLabel={tokenAmountLabel}
      currency="bitcoin"
      tokenBalance={balance}
      minTokenAmount={minTokenAmount}
      onSubmitForm={onSubmitForm}
      withMaxButton
      defaultAmount={defaultAmount}
    >
      <UnstakeDetails currency="bitcoin" />
      <Alert bg="oldPalette.opacity.blue.01" justifyContent="start" mt="10">
        <AlertIcon color="blue.50" w="15px" h="15px" alignSelf="self-start" />
        <AlertDescription>
          <Text size="sm">
            Withdrawals can take up to 72h to complete. You’ll be able to track
            the status in your dashboard after submitting the request.
          </Text>
        </AlertDescription>
      </Alert>
      <FormSubmitButton mt={8}>Request Withdraw</FormSubmitButton>
      <ActionDurationEstimation type="withdraw" />
    </TokenAmountForm>
  )
}

export default UnstakeFormModal
