import { useAcreContext } from "#/acre-react/hooks"
import { queryKeysFactory } from "#/constants"
import { ACTION_FLOW_TYPES, ActionFlowType, Fee } from "#/types"
import { useQuery } from "@tanstack/react-query"

export const initialFee: Fee = {
  tbtc: { fee: 0n, isReimbursable: false },
  acre: { fee: 0n, isReimbursable: false },
  total: 0n,
}

export default function useTransactionFee(
  amount: bigint | undefined,
  flow: ActionFlowType,
) {
  const { acre } = useAcreContext()

  return useQuery({
    queryKey: [
      ...queryKeysFactory.userKeys.estimateFee(),
      flow,
      amount?.toString(),
    ],
    queryFn: () => {
      if (!acre || !amount) return initialFee

      if (flow === ACTION_FLOW_TYPES.STAKE) {
        return acre.protocol.estimateDepositFee(amount)
      }

      return acre.protocol.estimateWithdrawalFee(amount)
    },
    initialData: initialFee,
    enabled: !!acre && !!amount,
  })
}
