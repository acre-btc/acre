import React from "react"
import { featureFlags } from "#/constants"
import { useTriggerConnectWalletModal } from "#/hooks"
import { Card, Grid } from "@chakra-ui/react"
import DashboardCard from "./DashboardCard"
import AcrePointsCard from "./AcrePointsCard"
import AcrePointsTemplateCard from "./AcrePointsTemplateCard"
import TransactionHistory from "./TransactionHistory"

export default function DashboardPage() {
  useTriggerConnectWalletModal()

  return (
    <Grid gridGap={{ base: 4, "2xl": 8 }} templateColumns="repeat(3, 1fr)">
      <DashboardCard gridColumn="span 2" />

      {featureFlags.ACRE_POINTS_ENABLED ? (
        <AcrePointsCard gridColumn="3 / span 1" />
      ) : (
        <AcrePointsTemplateCard gridRow="1 / 1" gridColumn="3 / span 1" />
      )}

      <Card w="100%" gridColumn="1 / span 1">
        BTC deposited
      </Card>
      <Card w="100%" gridColumn="2 / span 1">
        Rewards
      </Card>
      <Card w="100%" gridColumn="3 / span 1">
        APR(Est.)
      </Card>

      <Card gridColumn="span 3">Acre Vaults</Card>
      <Card gridColumn="span 3">
        <TransactionHistory />
      </Card>
    </Grid>
  )
}
