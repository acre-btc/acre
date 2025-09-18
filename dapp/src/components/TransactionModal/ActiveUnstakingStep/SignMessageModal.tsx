import React, { useCallback, useRef, useState } from "react"
import {
  useActionFlowPause,
  useActionFlowTokenAmount,
  useAppDispatch,
  useBitcoinPosition,
  useCancelPromise,
  useModal,
  usePostHogCapture,
  useTimeout,
  useTransactionDetails,
} from "#/hooks"
import { ACTION_FLOW_TYPES, Activity, PROCESS_STATUSES } from "#/types"
import { timeUtils, eip1193, logPromiseFailure } from "#/utils"
import { setStatus } from "#/store/action-flow"
import { useInitializeWithdraw } from "#/acre-react/hooks"
import { time, queryKeysFactory } from "#/constants"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import PostHogEvent from "#/posthog/events"
import BuildTransactionModal from "./BuildTransactionModal"
import WalletInteractionModal from "../WalletInteractionModal"

type WithdrawalStatus = "building-data" | "built-data" | "signature"

export default function SignMessageModal() {
  const [status, setWaitingStatus] = useState<WithdrawalStatus>("building-data")

  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const tokenAmount = useActionFlowTokenAmount()
  const amount = tokenAmount?.amount
  const { closeModal } = useModal()
  const { handlePause } = useActionFlowPause()
  const initializeWithdraw = useInitializeWithdraw()
  const { refetch: refetchBitcoinPosition } = useBitcoinPosition()

  const sessionId = useRef(Math.random())
  const { cancel, resolve, sessionIdToPromise } = useCancelPromise(
    sessionId.current,
    "Withdrawal cancelled",
  )
  const { transactionFee } = useTransactionDetails(
    amount,
    ACTION_FLOW_TYPES.UNSTAKE,
  )
  const { handleCapture, handleCaptureWithCause } = usePostHogCapture()

  const dataBuiltStepCallback = useCallback(() => {
    setWaitingStatus("built-data")
    return Promise.resolve()
  }, [])

  const onSignMessageCallback = useCallback(async () => {
    setWaitingStatus("signature")
    return resolve()
  }, [resolve])

  const onSignMessageSuccess = useCallback(() => {
    logPromiseFailure(refetchBitcoinPosition())
    dispatch(setStatus(PROCESS_STATUSES.SUCCEEDED))
    handleCapture(PostHogEvent.WithdrawalSuccess)
  }, [dispatch, refetchBitcoinPosition, handleCapture])

  const onSignMessageError = useCallback(
    (error: unknown) => {
      console.error(error)
      dispatch(setStatus(PROCESS_STATUSES.FAILED))
    },
    [dispatch],
  )

  const onError = useCallback(
    (error: unknown) => {
      if (!sessionIdToPromise[sessionId.current].shouldOpenErrorModal) return

      if (eip1193.didUserRejectRequest(error)) {
        handlePause()
      } else {
        onSignMessageError(error)
      }

      handleCaptureWithCause(error, PostHogEvent.WithdrawalFailure)
    },
    [
      sessionIdToPromise,
      handlePause,
      onSignMessageError,
      handleCaptureWithCause,
    ],
  )

  const { mutate: handleSignMessage } = useMutation({
    mutationKey: ["sign-message"],
    mutationFn: async () => {
      if (!amount) return

      const { redemptionRequestId } = await initializeWithdraw(
        amount,
        dataBuiltStepCallback,
        onSignMessageCallback,
      )

      queryClient.setQueriesData(
        { queryKey: queryKeysFactory.userKeys.activities() },
        (oldData: Activity[] | undefined) => {
          const newActivity: Activity = {
            id: redemptionRequestId.toString(),
            type: "withdraw",
            status: "pending",
            // This is a requested amount. The amount of BTC received will be
            // around: `amount - transactionFee.total`.
            // TODO: Based on the comment above: shouldn't we use total fee
            // instead of only Acre fee. We can also use `estimatedAmount` from
            // `useTransactionDetails` hook.
            amount: amount - transactionFee.acre.fee,
            initializedAt: timeUtils.dateToUnixTimestamp(),
            // The message is signed immediately after the initialization.
            finalizedAt: timeUtils.dateToUnixTimestamp(),
          }

          if (oldData) return [newActivity, ...oldData]
          return [newActivity]
        },
      )
    },
    onSuccess: onSignMessageSuccess,
    onError,
  })

  const onClose = () => {
    cancel()
    closeModal()
  }

  useTimeout(handleSignMessage, time.ONE_SEC_IN_MILLISECONDS)

  if (status === "building-data")
    return <BuildTransactionModal onClose={onClose} />

  if (status === "built-data")
    return <WalletInteractionModal step="opening-wallet" />

  return <WalletInteractionModal step="awaiting-transaction" />
}
