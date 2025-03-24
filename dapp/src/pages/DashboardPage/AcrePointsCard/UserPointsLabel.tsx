import React from "react"
import { Button, HStack, VStack, Text } from "@chakra-ui/react"
import { numbersUtils } from "#/utils"
import { useAcrePointsData, useClaimPoints, useUserPointsData } from "#/hooks"
import Spinner from "#/components/Spinner"
import TooltipIcon from "#/components/TooltipIcon"
import useDebounce from "#/hooks/useDebounce"
import { time } from "#/constants"
import LabelWrapper from "./LabelWrapper"
import { NextDropTimestampLabel } from "./AcrePointsLabel"

function ClaimableBalanceLabel() {
  const { mutate: claimPoints } = useClaimPoints()
  const { data: userPointsData } = useUserPointsData()
  const debouncedClaimPoints = useDebounce(
    claimPoints,
    time.ONE_SEC_IN_MILLISECONDS,
  )

  const claimableBalance = userPointsData?.claimableBalance || 0
  const formattedClaimablePointsAmount =
    numbersUtils.numberToLocaleString(claimableBalance)

  if (claimableBalance <= 0) return null

  return (
    <Button
      mt={5}
      onClick={debouncedClaimPoints}
      w="full"
      colorScheme="oldPalette.green"
      bgColor="green.50"
      color="ivoire.10"
      fontWeight="semibold"
      size="lg"
    >
      Claim {formattedClaimablePointsAmount} PTS
    </Button>
  )
}

function CalculationInProgressLabel() {
  const { data } = useUserPointsData()

  return (
    <VStack spacing={4}>
      {!data?.claimableBalance && (
        <Text size="md" color="text.tertiary">
          Please wait...
        </Text>
      )}
      <HStack spacing={0}>
        <Spinner mr={3} size="sm" />
        <Text size="md">Your drop is being prepared.</Text>
        <TooltipIcon
          label={`
            We need some time to calculate your points. It may take up to 30 minutes. 
            ${data?.claimableBalance ? "You can still claim points from previous drops." : ""}
          `}
          maxW={72}
        />
      </HStack>
    </VStack>
  )
}

export default function UserPointsLabel() {
  const { data: acrePointsData } = useAcrePointsData()
  const { data: userPointsData } = useUserPointsData()

  if (acrePointsData || userPointsData?.isEligible) {
    if (acrePointsData?.isCalculationInProgress)
      return (
        <LabelWrapper>
          <CalculationInProgressLabel />
          <ClaimableBalanceLabel />
        </LabelWrapper>
      )

    return (
      <LabelWrapper>
        <NextDropTimestampLabel />
        <ClaimableBalanceLabel />
      </LabelWrapper>
    )
  }

  return null
}
