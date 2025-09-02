import React from "react"
import { featureFlags } from "#/constants"
import { useTriggerConnectWalletModal, useWallet } from "#/hooks"
import usePositionStats from "#/hooks/usePositionStats"
import { Card, Grid, VStack } from "@chakra-ui/react"
import Vaults from "#/components/Vaults"
import WithdrawalStatusBanner, {
  WithdrawStatus,
} from "#/components/WithdrawalStatusBanner"
import DashboardCard from "./DashboardCard"
import AcrePointsCard from "./AcrePointsCard"
import AcrePointsTemplateCard from "./AcrePointsTemplateCard"
import TransactionHistory from "./TransactionHistory"
import BTCDepositedCard from "./BTCDepositedCard"
import RewardsEarnedCard from "./RewardsEarnedCard"
import EstimatedAPRCard from "./EstimatedAPRCard"

const fullWidthGridColumn = { base: "1", md: "span 3" }

const grid = {
  dashboard: { base: "1", md: "span 2" },
  points: { base: "1", md: "3 / span 1" },
  withdrawals: fullWidthGridColumn,
  stats: { base: "1", md: "auto / span 1" },
  vaults: fullWidthGridColumn,
  history: fullWidthGridColumn,
}

// TODO: Temporary hook. Fetch on-chain data and order by status. `ready` or
// `pending` first ?
const useWithdrawals: () => {
  data: {
    withdrawnAt: number
    btcAmount: bigint
    status: WithdrawStatus
  }[]
} = () => ({
  data: [
    { withdrawnAt: 1753274685, btcAmount: 30000000n, status: "ready" },
    { withdrawnAt: 1753533885, btcAmount: 20000000n, status: "pending" },
  ],
})

export default function DashboardPage() {
  useTriggerConnectWalletModal()
  const { data, isLoading } = usePositionStats()
  const { isConnected } = useWallet()

  const { data: withdrawals } = useWithdrawals()

  return (
    <Grid
      gridGap={{ base: 4, "2xl": 8 }}
      templateColumns={{ base: "1fr ", md: "repeat(3, 1fr)" }}
    >
      <DashboardCard gridColumn={grid.dashboard} />

      {featureFlags.ACRE_POINTS_ENABLED ? (
        <AcrePointsCard gridColumn={grid.points} />
      ) : (
        <AcrePointsTemplateCard gridColumn={grid.points} />
      )}
      <VStack as="div" gridColumn={grid.withdrawals} spacing={4}>
        {withdrawals.map((withdrawal) => (
          <WithdrawalStatusBanner
            key={withdrawal.withdrawnAt}
            status={withdrawal.status}
            btcAmount={withdrawal.btcAmount}
            withdrawnAt={withdrawal.withdrawnAt}
          />
        ))}
      </VStack>

      {isConnected && (
        <>
          <BTCDepositedCard
            gridColumn={grid.stats}
            isLoading={isLoading}
            btcAmount={data?.deposited}
          />
          <RewardsEarnedCard
            gridColumn={grid.stats}
            isLoading={isLoading}
            btcAmount={data?.earned}
          />
          <EstimatedAPRCard gridColumn={grid.stats} />
        </>
      )}

      <Vaults gridColumn={grid.vaults} />

      <Card gridColumn={grid.history}>
        <TransactionHistory />
      </Card>
    </Grid>
  )
}
