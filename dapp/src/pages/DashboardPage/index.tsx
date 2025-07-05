import React from "react"
import { featureFlags } from "#/constants"
import { useTriggerConnectWalletModal } from "#/hooks"
import { Grid } from "@chakra-ui/react"
import DashboardCard from "./DashboardCard"
import AcrePointsCard from "./AcrePointsCard"
import AcrePointsTemplateCard from "./AcrePointsTemplateCard"
import AcreTVLProgress from "./AcreTVLProgress"

export default function DashboardPage() {
  useTriggerConnectWalletModal()

  return (
    <Grid
      gridGap={{ base: 4, "2xl": 8 }}
      gridTemplateAreas={{
        base: `
          ${featureFlags.TVL_ENABLED ? '"tvl"' : ""}
          "dashboard"
          "acre-points"
        `,
        sm: `
          ${featureFlags.TVL_ENABLED ? '"tvl tvl"' : ""}
          "dashboard acre-points"
          "dashboard acre-points"
          `,
      }}
      gridTemplateColumns={{
        base: "1fr",
        sm: "1fr 1fr",
        lg: "1fr 31%",
        "2xl": "1fr 36%",
      }}
      gridTemplateRows={{
        base: `
          ${featureFlags.TVL_ENABLED ? "auto" : ""}
          auto
          auto
          1fr
        `,
        sm: `
          ${featureFlags.TVL_ENABLED ? "auto" : ""}
          auto
          1fr
          `,
      }}
    >
      {featureFlags.TVL_ENABLED && <AcreTVLProgress gridArea="tvl" />}

      <DashboardCard gridArea="dashboard" h="fit-content" />

      {featureFlags.ACRE_POINTS_ENABLED ? (
        <AcrePointsCard gridArea="acre-points" h="fit-content" />
      ) : (
        <AcrePointsTemplateCard gridArea="acre-points" h="fit-content" />
      )}
    </Grid>
  )
}
