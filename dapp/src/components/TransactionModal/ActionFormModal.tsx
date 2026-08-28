import React, { useCallback, useEffect, useState } from "react"
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
  PROCESS_STATUSES,
  WithdrawalDestination,
} from "#/types"
import { TokenAmountFormValues } from "#/components/shared/TokenAmountForm/TokenAmountFormBase"
import { logPromiseFailure } from "#/utils"
import {
  setStatus,
  setTokenAmount,
  setWithdrawalDestination,
} from "#/store/action-flow"
import StakeFormModal from "./ActiveStakingStep/StakeFormModal"
import UnstakeFormModal from "./ActiveUnstakingStep/UnstakeFormModal"
import { UnstakeFormValues } from "./ActiveUnstakingStep/UnstakeFormModal/UnstakeFormBase"

const HEADING: Record<ActionFlowType, string> = {
  [ACTION_FLOW_TYPES.STAKE]: "Deposit",
  [ACTION_FLOW_TYPES.UNSTAKE]: "Request withdraw",
}

function ActionFormModal({ type }: { type: ActionFlowType }) {
  const { initStake } = useStakeFlowContext()
  const dispatch = useAppDispatch()
  const minWithdrawAmount = useMinWithdrawAmount()
  const { data } = useBitcoinPosition()
  const depositedAmount = data?.estimatedBitcoinBalance ?? 0n
  const status = useActionFlowStatus()

  const [isLoading, setIsLoading] = useState(false)

  const heading = HEADING[type]

  const handleInitStake = useCallback(async () => {
    await initStake()
  }, [initStake])

  const handleUnstake = useCallback(
    (amount: bigint, destination: WithdrawalDestination) => {
      // The leave-behind rule exists because of the tBTC Bridge dust threshold,
      // which the tBTC-to-EVM path never touches. Applying it there would route
      // the user into NotEnoughFundsModal for no reason.
      if (destination.type === "tbtc") {
        dispatch(setStatus(PROCESS_STATUSES.PENDING))
        return
      }

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

  const handleStakeSubmit = useCallback(
    async ({ amount }: TokenAmountFormValues) => {
      if (!amount) return

      try {
        setIsLoading(true)
        await handleInitStake()
        dispatch(setTokenAmount({ amount, currency: "bitcoin" }))
      } catch (error) {
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    },
    [dispatch, handleInitStake],
  )

  const handleUnstakeSubmit = useCallback(
    ({ amount, withdrawToTbtc, destinationAddress }: UnstakeFormValues) => {
      if (!amount) return

      const destination: WithdrawalDestination =
        withdrawToTbtc && destinationAddress
          ? { type: "tbtc", evmAddress: destinationAddress.trim() }
          : { type: "bitcoin" }

      dispatch(setWithdrawalDestination(destination))
      handleUnstake(amount, destination)
      dispatch(setTokenAmount({ amount, currency: "bitcoin" }))
    },
    [dispatch, handleUnstake],
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
          {type === ACTION_FLOW_TYPES.STAKE ? (
            <StakeFormModal
              onSubmitForm={(values) =>
                logPromiseFailure(handleStakeSubmit(values))
              }
            />
          ) : (
            <UnstakeFormModal onSubmitForm={handleUnstakeSubmit} />
          )}
        </Box>
      </ModalBody>
    </>
  )
}

export default ActionFormModal
