import React, { ReactNode, useCallback, useEffect, useState } from "react"
import { Box, ModalBody, ModalCloseButton, ModalHeader } from "@chakra-ui/react"
import {
  useActionFlowStatus,
  useAppDispatch,
  useBitcoinPosition,
  useMinWithdrawAmount,
  useStakeFlowContext,
} from "#/hooks"
import {
  ACTION_FLOW_TYPES,
  ActionFlowType,
  BaseFormProps,
  PROCESS_STATUSES,
} from "#/types"
import { TokenAmountFormValues } from "#/components/shared/TokenAmountForm/TokenAmountFormBase"
import { logPromiseFailure } from "#/utils"
import { setStatus, setTokenAmount } from "#/store/action-flow"
import StakeFormModal from "./ActiveStakingStep/StakeFormModal"
import UnstakeFormModal from "./ActiveUnstakingStep/UnstakeFormModal"

const FORM_DATA: Record<
  ActionFlowType,
  {
    heading: string
    FormComponent: (props: BaseFormProps<TokenAmountFormValues>) => ReactNode
  }
> = {
  [ACTION_FLOW_TYPES.STAKE]: {
    heading: "Deposit",
    FormComponent: StakeFormModal,
  },
  [ACTION_FLOW_TYPES.UNSTAKE]: {
    heading: "Request withdraw",
    FormComponent: UnstakeFormModal,
  },
}

function ActionFormModal({ type }: { type: ActionFlowType }) {
  const { initStake } = useStakeFlowContext()
  const dispatch = useAppDispatch()
  const minWithdrawAmount = useMinWithdrawAmount()
  const { data } = useBitcoinPosition()
  const depositedAmount = data?.estimatedBitcoinBalance ?? 0n
  const status = useActionFlowStatus()

  const [isLoading, setIsLoading] = useState(false)

  const { heading, FormComponent } = FORM_DATA[type]

  const handleInitStake = useCallback(async () => {
    await initStake()
  }, [initStake])

  const handleUnstake = useCallback(
    (amount: bigint) => {
      const hasEnoughFundsForFutureWithdrawals =
        depositedAmount - amount >= minWithdrawAmount

      const hasSubmittedMaxWithdrawalAmount = depositedAmount === amount

      if (
        !hasSubmittedMaxWithdrawalAmount &&
        !hasEnoughFundsForFutureWithdrawals
      ) {
        dispatch(setStatus(PROCESS_STATUSES.NOT_ENOUGH_FUNDS))
      } else {
        dispatch(setStatus(PROCESS_STATUSES.PENDING))
      }
    },
    [depositedAmount, dispatch, minWithdrawAmount],
  )

  const handleSubmitForm = useCallback(
    async (values: TokenAmountFormValues) => {
      if (!values.amount) return

      try {
        setIsLoading(true)
        if (type === ACTION_FLOW_TYPES.STAKE) await handleInitStake()
        if (type === ACTION_FLOW_TYPES.UNSTAKE) handleUnstake(values.amount)

        dispatch(setTokenAmount({ amount: values.amount, currency: "bitcoin" }))
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    },
    [dispatch, handleInitStake, handleUnstake, type],
  )

  const handleSubmitFormWrapper = useCallback(
    (values: TokenAmountFormValues) =>
      logPromiseFailure(handleSubmitForm(values)),
    [handleSubmitForm],
  )

  useEffect(() => {
    // Set the status only when it is the user's first step
    if (status === PROCESS_STATUSES.IDLE) {
      dispatch(setStatus(PROCESS_STATUSES.PENDING))
    }
  }, [dispatch, status])

  return (
    <>
      {!isLoading && <ModalCloseButton />}
      <ModalHeader>{heading}</ModalHeader>
      <ModalBody>
        <Box w="100%">
          <FormComponent onSubmitForm={handleSubmitFormWrapper} />
        </Box>
      </ModalBody>
    </>
  )
}

export default ActionFormModal
