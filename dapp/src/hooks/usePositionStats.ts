import { useAcreContext } from "#/acre-react/hooks"
import { queryKeysFactory } from "#/constants"
import { useQuery } from "@tanstack/react-query"

export default function usePositionStats() {
  const { acre, isInitialized, isConnected } = useAcreContext()

  return useQuery({
    queryKey: [...queryKeysFactory.userKeys.positionStats()],
    queryFn: async () => {
      if (!acre) throw new Error("Acre SDK not available")

      const currentBalance = await acre.account.estimatedBitcoinBalance()
      const withdrawals = await acre.account.getWithdrawals()
      const deposits = await acre.account.getDeposits()

      const sumOfWithdrawals = withdrawals.reduce(
        (sum, withdrawal) => sum + withdrawal.amount,
        0n,
      )
      const sumOfDeposits = deposits.reduce(
        (sum, deposit) => sum + deposit.amount,
        0n,
      )

      const earned = currentBalance + sumOfWithdrawals - sumOfDeposits

      return { deposited: currentBalance, earned: earned < 0n ? 0n : earned }
    },
    enabled: isInitialized && isConnected && !!acre,
  })
}
