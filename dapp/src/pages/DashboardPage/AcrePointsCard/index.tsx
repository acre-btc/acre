import React from "react"
import {
  Card,
  CardBody,
  CardHeader,
  CardProps,
  HStack,
  Image,
  Text,
} from "@chakra-ui/react"
import { numbersUtils } from "#/utils"
import { useAcrePointsData, useUserPointsData, useWallet } from "#/hooks"
import UserDataSkeleton from "#/components/shared/UserDataSkeleton"
import TooltipIcon from "#/components/shared/TooltipIcon"
import acrePointsIllustrationSrc from "#/assets/images/acre-points-illustration.png"
import UserPointsLabel from "./UserPointsLabel"

const { numberToLocaleString } = numbersUtils

export default function AcrePointsCard(props: CardProps) {
  const { data: acrePointsData } = useAcrePointsData()
  const { data: userPointsData } = useUserPointsData()
  const { isConnected } = useWallet()

  const formattedUserTotalBalance = numberToLocaleString(
    userPointsData?.totalBalance ?? 0,
  )
  const formattedTotalPoolBalance = numberToLocaleString(
    acrePointsData?.totalPoolBalance ?? 0,
  )

  return (
    <Card {...props}>
      <CardHeader mb={2} as={HStack} justify="space-between">
        <Text size="md" color="text.primary">
          {isConnected ? <>Your Acre points</> : <>Acre users earned</>}
        </Text>

        <TooltipIcon
          label={
            isConnected
              ? "Your current balance of Acre points collected so far."
              : "Total points distributed to Acre users so far."
          }
          w={56}
        />
      </CardHeader>

      <CardBody>
        <UserDataSkeleton>
          <Text size="4xl" fontWeight="semibold" mb={2}>
            {isConnected
              ? formattedUserTotalBalance
              : formattedTotalPoolBalance}
          </Text>
        </UserDataSkeleton>

        <Image src={acrePointsIllustrationSrc} mt={6} />

        {isConnected && (
          <UserDataSkeleton>
            <UserPointsLabel />
          </UserDataSkeleton>
        )}
      </CardBody>
    </Card>
  )
}
