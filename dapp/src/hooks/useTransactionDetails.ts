import { ACTION_FLOW_TYPES, ActionFlowType } from "#/types"
import useTransactionFee from "./useTransactionFee"

export default function useTransactionDetails(
  amount: bigint | undefined,
  flow: ActionFlowType = ACTION_FLOW_TYPES.STAKE,
) {
  const { data: transactionFee } = useTransactionFee(amount, flow)

  return {
    amount,
    transactionFee,
    estimatedAmount: amount ?? 0n - transactionFee.total,
  }
}
