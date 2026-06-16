import React, { useCallback, useRef } from "react"
import {
  useActionFlowPause,
  useActionFlowTokenAmount,
  useAppDispatch,
  useBitcoinBalance,
  useCancelPromise,
  useDepositBTCTransaction,
  usePostHogCapture,
  useStakeFlowContext,
} from "#/hooks"
import PostHogEvent from "#/posthog/events"
import { setStatus, setTxHash } from "#/store/action-flow"
import { time } from "#/constants"
import { PROCESS_STATUSES } from "#/types"
import { eip1193, logPromiseFailure } from "#/utils"
import { useTimeout } from "@chakra-ui/react"
import { useMutation } from "@tanstack/react-query"
import WalletInteractionModal from "../WalletInteractionModal"

export default function DepositBTCModal() {
  const tokenAmount = useActionFlowTokenAmount()
  const { btcAddress, depositReceipt, stake } = useStakeFlowContext()
  const dispatch = useAppDispatch()
  const { handlePause } = useActionFlowPause()
  const { refetch: refetchBitcoinBalance } = useBitcoinBalance()
  const { handleCapture, handleCaptureWithCause } = usePostHogCapture()

  const sessionId = useRef(Math.random())
  const { cancel, resolve, sessionIdToPromise } = useCancelPromise(
    sessionId.current,
    "Deposit cancelled",
  )

  const onStakeBTCSuccess = useCallback(() => {
    logPromiseFailure(refetchBitcoinBalance())
    dispatch(setStatus(PROCESS_STATUSES.SUCCEEDED))
  }, [dispatch, refetchBitcoinBalance])

  const onError = useCallback(
    (error: unknown) => {
      console.error(error)
      dispatch(setStatus(PROCESS_STATUSES.FAILED))
    },
    [dispatch],
  )

  const { mutate: handleStake } = useMutation({
    mutationKey: ["stake"],
    mutationFn: stake,
    onSuccess: onStakeBTCSuccess,
    onError,
  })

  const onDepositBTCSuccess = useCallback(
    (transactionHash: string) => {
      dispatch(setTxHash(transactionHash))
      handleStake()
      handleCapture(PostHogEvent.DepositSuccess, {
        transactionHash,
      })
    },
    [dispatch, handleStake, handleCapture],
  )

  const onDepositBTCError = useCallback(
    (error: unknown) => {
      if (!sessionIdToPromise[sessionId.current].shouldOpenErrorModal) return

      if (eip1193.didUserRejectRequest(error)) {
        handlePause()
      } else {
        onError(error)
      }

      handleCaptureWithCause(error, PostHogEvent.DepositFailure)
    },
    [sessionIdToPromise, handlePause, onError, handleCaptureWithCause],
  )

  const { mutate: sendBitcoinTransaction, status } = useDepositBTCTransaction({
    onSuccess: onDepositBTCSuccess,
    onError: onDepositBTCError,
  })

  const handledDepositBTC = useCallback(async () => {
    if (!tokenAmount?.amount || !btcAddress || !depositReceipt) return

    await resolve()

    sendBitcoinTransaction({
      recipient: btcAddress,
      amount: tokenAmount?.amount,
    })
  }, [
    tokenAmount?.amount,
    btcAddress,
    depositReceipt,
    resolve,
    sendBitcoinTransaction,
  ])

  const handledDepositBTCWrapper = useCallback(() => {
    logPromiseFailure(handledDepositBTC())
  }, [handledDepositBTC])

  useTimeout(handledDepositBTCWrapper, time.ONE_SEC_IN_MILLISECONDS)

  if (status === "pending" || status === "success")
    return <WalletInteractionModal step="awaiting-transaction" />

  return <WalletInteractionModal step="opening-wallet" onClose={cancel} />
}
