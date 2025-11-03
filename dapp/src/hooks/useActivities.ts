import { queryKeysFactory, time } from "#/constants"
import { useQuery } from "@tanstack/react-query"
import { Activity } from "#/types"
import { DepositStatus, Withdrawal } from "@acre-btc/sdk"
import { useAcreContext } from "#/acre-react/hooks"
import { activitiesUtils } from "#/utils"
import useWallet from "./useWallet"

const { userKeys } = queryKeysFactory

const SDK_STATUS_TO_DAPP_STATUS: Record<
  Withdrawal["status"],
  Activity["status"]
> = {
  requested: "requested",
  initialized: "pending",
  finalized: "completed",
}

export default function useActivities<TSelected = Activity[]>(
  select?: (data: Activity[] | undefined) => TSelected,
) {
  const { address } = useWallet()
  const { acre, isConnected } = useAcreContext()

  return useQuery({
    queryKey: [...userKeys.activities(), { acre, isConnected, address }],
    enabled: isConnected && !!acre && !!address,
    queryFn: async () => {
      if (!acre) return undefined

      const deposits: Activity[] = (await acre.account.getDeposits()).map(
        (deposit) => {
          let status: Activity["status"] = "pending"
          if (deposit.status === DepositStatus.Finalized) status = "completed"
          if (deposit.status === DepositStatus.Migrated) status = "migrated"

          return {
            ...deposit,
            status,
            type: "deposit",
          }
        },
      )

      const withdrawals: Activity[] = (await acre.account.getWithdrawals()).map(
        (withdraw) => {
          const status = SDK_STATUS_TO_DAPP_STATUS[withdraw.status]

          const initializedAt: number = withdraw.requestedAt

          return {
            id: withdraw.id,
            initializedAt,
            txHash: withdraw.bitcoinTransactionId,
            status,
            amount: withdraw.amount,
            type: "withdraw",
          }
        },
      )
      return activitiesUtils.sortActivitiesByTimestamp([
        ...deposits,
        ...withdrawals,
      ])
    },
    select,
    refetchInterval: time.REFETCH_INTERVAL_IN_MILLISECONDS,
  })
}
