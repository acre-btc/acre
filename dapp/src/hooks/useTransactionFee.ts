import { useAcreContext } from "#/acre-react/hooks"
import { queryKeysFactory } from "#/constants"
import {
  ACTION_FLOW_TYPES,
  ActionFlowType,
  Fees,
  WithdrawalDestination,
} from "#/types"
import { feesUtils } from "#/utils"
import { useQuery } from "@tanstack/react-query"

export const initialFee: Fees = {
  tbtc: { fee: 0n, isReimbursable: false },
  acre: { fee: 0n, isReimbursable: false },
  total: 0n,
}

export default function useTransactionFee(
  amount: bigint | undefined,
  flow: ActionFlowType,
  withdrawalDestination: WithdrawalDestination["type"] = "bitcoin",
) {
  const { acre } = useAcreContext()

  return useQuery({
    queryKey: [
      ...queryKeysFactory.userKeys.estimateFee(),
      flow,
      amount?.toString(),
      withdrawalDestination,
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

      return feesUtils.forWithdrawalDestination(
        await acre.protocol.estimateWithdrawalFee(amount),
        withdrawalDestination,
      )
    },
    initialData: initialFee,
    enabled: !!acre && !!amount,
  })
}
