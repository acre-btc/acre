import {
  ACTION_FLOW_TYPES,
  ActionFlowType,
  WithdrawalDestination,
} from "#/types"
import useTransactionFee from "./useTransactionFee"

export default function useTransactionDetails(
  amount: bigint,
  flow: ActionFlowType = ACTION_FLOW_TYPES.STAKE,
  withdrawalDestination: WithdrawalDestination["type"] = "bitcoin",
) {
  const { data: transactionFee } = useTransactionFee(
    amount,
    flow,
    withdrawalDestination,
  )

  return {
    amount,
    transactionFee,
    estimatedAmount: amount - transactionFee.total,
  }
}
