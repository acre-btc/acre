import { useMemo } from "react"
import useActivities from "./useActivities"
import useBitcoinPosition from "./useBitcoinPosition"

export default function usePositionStats() {
  const { data, isLoading } = useActivities()
  const { data: position, isLoading: isLoadingBitcoinPosition } =
    useBitcoinPosition()

  const positionStats = useMemo(() => {
    if (!data || !position) return undefined

    const currentBalance = position.estimatedBitcoinBalance
    const withdrawals = data.filter((activity) => activity.type === "withdraw")
    const deposits = data.filter((activity) => activity.type === "deposit")

    const sumOfWithdrawals = withdrawals.reduce(
      (sum, withdrawal) => sum + withdrawal.amount,
      0n,
    )
    const sumOfDeposits = deposits.reduce(
      (sum, deposit) => sum + deposit.amount,
      0n,
    )

    const earned = currentBalance + sumOfWithdrawals - sumOfDeposits

    return { deposited: sumOfDeposits, earned: earned < 0n ? 0n : earned }
  }, [data, position])

  return { data: positionStats, isLoading, isLoadingBitcoinPosition }
}
