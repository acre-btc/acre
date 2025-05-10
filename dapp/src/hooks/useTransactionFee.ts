import { useAcreContext } from "#/acre-react/hooks"
import { logPromiseFailure } from "#/utils"
import { useEffect, useState } from "react"
import { ACTION_FLOW_TYPES, ActionFlowType, Fee } from "#/types"
import { useAppDispatch } from "./store"

export const initialFee: Fee = {
  tbtc: { fee: 0n, isReimbursable: false },
  acre: { fee: 0n, isReimbursable: false },
  total: 0n,
}

export default function useTransactionFee(
  amount: bigint | undefined,
  flow: ActionFlowType,
): Fee {
  const [depositFee, setDepositFee] = useState<Fee>(initialFee)
  const { acre } = useAcreContext()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (!amount) {
      setDepositFee(initialFee)
    } else {
      const getEstimatedDepositFee = async () => {
        if (!acre) return

        let fee: Fee = initialFee

        if (flow === ACTION_FLOW_TYPES.STAKE) {
          fee = await acre.protocol.estimateDepositFee(amount)
        } else if (flow === ACTION_FLOW_TYPES.UNSTAKE) {
          fee = await acre.protocol.estimateWithdrawalFee(amount)
        }

        setDepositFee(fee)
      }
      logPromiseFailure(getEstimatedDepositFee())
    }
  }, [acre, dispatch, amount, flow])

  return depositFee
}
