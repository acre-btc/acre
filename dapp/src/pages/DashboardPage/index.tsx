import React from "react"
import { featureFlags } from "#/constants"
import { useTriggerConnectWalletModal } from "#/hooks"
import { Card, Grid } from "@chakra-ui/react"
import DashboardCard from "./DashboardCard"
import AcrePointsCard from "./AcrePointsCard"
import AcrePointsTemplateCard from "./AcrePointsTemplateCard"
import TransactionHistory from "./TransactionHistory"
import BTCDepositedCard from "./BTCDepositedCard"

const fullWidthGridColumn = { base: "1", md: "span 3" }

const grid = {
  dashboard: { base: "1", md: "span 2" },
  points: { base: "1", md: "3 / span 1" },
  stats: { base: "1", md: "auto / span 1" },
  vaults: fullWidthGridColumn,
  history: fullWidthGridColumn,
}

export default function DashboardPage() {
  useTriggerConnectWalletModal()

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

      {/* TODO: Add all cards */}
      <BTCDepositedCard w="100%" gridColumn={grid.stats} />
      <BTCDepositedCard w="100%" gridColumn={grid.stats} />
      <BTCDepositedCard w="100%" gridColumn={grid.stats} />

      <Card gridColumn={grid.vaults}>Acre Vaults</Card>

      <Card gridColumn={grid.history}>
        <TransactionHistory />
      </Card>
    </Grid>
  )
}
