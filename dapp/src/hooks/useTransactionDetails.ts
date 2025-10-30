import { ACTION_FLOW_TYPES, ActionFlowType } from "#/types"
import useTransactionFee from "./useTransactionFee"

export default function useTransactionDetails(
  amount: bigint,
  flow: ActionFlowType = ACTION_FLOW_TYPES.STAKE,
) {
  const { data: transactionFee } = useTransactionFee(amount, flow)

  return {
    amount,
    transactionFee,
    estimatedAmount: amount - transactionFee.total,
  }
}
