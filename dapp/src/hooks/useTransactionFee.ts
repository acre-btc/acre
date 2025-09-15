import { useAcreContext } from "#/acre-react/hooks"
import { queryKeysFactory } from "#/constants"
import { ACTION_FLOW_TYPES, ActionFlowType, Fees } from "#/types"
import { useQuery } from "@tanstack/react-query"

export const initialFee: Fees = {
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
    queryFn: async () => {
      if (!acre || !amount) return initialFee

      if (flow === ACTION_FLOW_TYPES.STAKE) {
        const fees = await acre.protocol.estimateDepositFee(amount)
        return {
          ...fees,
          tbtc: { fee: 0n, isReimbursable: false },
        }
      }

      return acre.protocol.estimateWithdrawalFee(amount)
    },
    initialData: initialFee,
    enabled: !!acre && !!amount,
  })
}
