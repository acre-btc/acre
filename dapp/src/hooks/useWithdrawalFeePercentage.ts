import { useAcreContext } from "#/acre-react/hooks"
import { queryKeysFactory } from "#/constants"
import { useQuery } from "@tanstack/react-query"

const SAMPLE_DEPOSIT_AMOUNT = 100000000n // 1 BTC in satoshis for fee calculation

export default function useWithdrawalFeePercentage() {
  const { acre } = useAcreContext()

  return useQuery({
    queryKey: [
      ...queryKeysFactory.userKeys.estimateFee(),
      "withdrawalFeePercentage",
    ],
    queryFn: async () => {
      if (!acre) throw new Error("Acre SDK not available")

      const fees = await acre.protocol.estimateWithdrawalFee(
        SAMPLE_DEPOSIT_AMOUNT,
      )

      const feePercentage =
        (Number(fees.total) / Number(SAMPLE_DEPOSIT_AMOUNT)) * 100
      return feePercentage
    },
    enabled: !!acre,
    // Cache the result for 5 minutes since fee percentages don't change frequently
    staleTime: 5 * 60 * 1000,
  })
}
