import { queryKeysFactory, time } from "#/constants"
import { acreApi } from "#/utils"
import { useQuery } from "@tanstack/react-query"

const { acreKeys } = queryKeysFactory

const useStatistics = () =>
  useQuery({
    queryKey: [...acreKeys.statistics()],
    queryFn: acreApi.getStatistics,
    refetchInterval: time.REFETCH_INTERVAL_IN_MILLISECONDS,
    select: (data) => {
      const bitcoinTvl = data.btc
      const usdTvl = data.usd
      const tvlCap = data.cap

      const isCapExceeded = bitcoinTvl > tvlCap

      const progress = isCapExceeded
        ? 100
        : Math.floor((bitcoinTvl / tvlCap) * 100)

      const remaining = isCapExceeded ? 0 : tvlCap - bitcoinTvl

      return {
        tvl: {
          progress,
          value: bitcoinTvl,
          usdValue: usdTvl,
          isCapExceeded,
          remaining,
          cap: tvlCap,
        },
      }
    },
    initialData: {
      usd: 0,
      btc: 0,
      cap: 0,
    },
  })

export default useStatistics
