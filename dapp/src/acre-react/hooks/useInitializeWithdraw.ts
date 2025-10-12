import { useCallback } from "react"
import {
  DataBuiltStepCallback,
  MessageSignedStepCallback,
  OnSignMessageStepCallback,
} from "@acre-btc/sdk"
import useAcreContext from "./useAcreContext"

export default function useInitializeWithdraw() {
  const { acre, isConnected } = useAcreContext()

  return useCallback(
    async (
      amount: bigint,
      dataBuiltStepCallback?: DataBuiltStepCallback,
      onSignMessageStep?: OnSignMessageStepCallback,
      messageSignedStep?: MessageSignedStepCallback,
    ) => {
      if (!acre || !isConnected) throw new Error("Account not connected")

      return acre.account.initializeWithdrawal(
        amount,
        dataBuiltStepCallback,
        onSignMessageStep,
        messageSignedStep,
      )
    },
    [acre, isConnected],
  )
}
