import React from "react"
import {
  // useActivitiesCount,
  useBitcoinPosition,
  useTransactionModal,
  useStatistics,
  useWallet,
  useMobileMode,
  useActivities,
} from "#/hooks"
import { ACTION_FLOW_TYPES } from "#/types"
import {
  Button,
  ButtonProps,
  Flex,
  HStack,
  VStack,
  Text,
} from "@chakra-ui/react"
import ArrivingSoonTooltip from "#/components/ArrivingSoonTooltip"
import UserDataSkeleton from "#/components/shared/UserDataSkeleton"
import { featureFlags } from "#/constants"
import { IconClockHour5Filled } from "@tabler/icons-react"
import TooltipIcon from "#/components/shared/TooltipIcon"
import { activitiesUtils } from "#/utils"
import CurrencyBalance from "#/components/shared/CurrencyBalance"
import AcreTVLMessage from "./AcreTVLMessage"

const isWithdrawalFlowEnabled = featureFlags.WITHDRAWALS_ENABLED

const buttonStyles: ButtonProps = {
  size: "lg",
  flex: 1,
  w: 40,
  fontWeight: "bold",
  lineHeight: 6,
  px: 7,
  h: "auto",
}

export default function PositionDetails() {
  const { data: bitcoinPosition } = useBitcoinPosition()
  const shares = bitcoinPosition?.sharesBalance ?? 0n

  const openDepositModal = useTransactionModal(ACTION_FLOW_TYPES.STAKE)
  const openWithdrawModal = useTransactionModal(ACTION_FLOW_TYPES.UNSTAKE)
  // const activitiesCount = useActivitiesCount()
  const { data: activities } = useActivities()
  const isMobileMode = useMobileMode()

  const statistics = useStatistics()

  const { tvl } = statistics.data

  const { isConnected } = useWallet()

  const isDisabledForMobileMode =
    isMobileMode && !featureFlags.MOBILE_MODE_ENABLED

  return (
    <Flex w="100%" flexDirection="column" gap={5}>
      <VStack alignItems="start" spacing={0}>
        {/* TODO: Component should be moved to `CardHeader` */}
        <HStack>
          <Text size="md">Your Acre balance</Text>
          {activitiesUtils.hasPendingDeposits(activities ?? []) && (
            <TooltipIcon
              icon={IconClockHour5Filled}
              label="Your balance will update once the pending deposit is finalized."
              placement="right"
            />
          )}
        </HStack>
        <UserDataSkeleton>
          <VStack alignItems="start" spacing={0}>
            <CurrencyBalance
              amount={shares}
              currency="acrebtc"
              size="4xl"
              letterSpacing="-0.075rem" // -1.2px
              color="text.primary"
            />
          </VStack>
        </UserDataSkeleton>
      </VStack>

      <HStack w="full" justify="start" flexWrap="wrap" spacing={5}>
        <UserDataSkeleton>
          <ArrivingSoonTooltip
            label="This option is not available on mobile yet. Please use the desktop app to deposit."
            shouldDisplayTooltip={isDisabledForMobileMode}
          >
            <Button
              {...buttonStyles}
              onClick={openDepositModal}
              isDisabled={
                (featureFlags.DEPOSIT_CAP_ENABLED && tvl.isCapExceeded) ||
                isDisabledForMobileMode
              }
            >
              Deposit
            </Button>
          </ArrivingSoonTooltip>
        </UserDataSkeleton>
        {/* TODO: Uncomment when withdrawals are supported. Right now we want to
         * show the withdraw button to all users so they are aware we are in the phased launch.
         */}
        {/* {isConnected && activitiesCount > 0 && ( */}
        {isConnected && (
          <UserDataSkeleton>
            <ArrivingSoonTooltip
              label={
                isMobileMode ? (
                  "This option is not available on mobile yet. Please use the desktop app to withdraw."
                ) : (
                  // TODO: Update to another copy once withdrawals are released.
                  <Text>
                    <b>Notice: Temporary Pause on Withdrawals</b>
                    <br />
                    <br />
                    Withdrawals from the acreBTC vault are temporarily paused
                    while we complete an update. Your funds remain fully secure
                    and under your control. Withdrawals will be re-enabled
                    within the next 72 hours.
                    <br />
                    <br />
                    Thank you for your patience as we finalize this upgrade.
                  </Text>
                )
              }
              shouldDisplayTooltip={
                !isWithdrawalFlowEnabled || isDisabledForMobileMode
              }
            >
              <Button
                variant="outline"
                {...buttonStyles}
                onClick={openWithdrawModal}
                isDisabled={!isWithdrawalFlowEnabled || isDisabledForMobileMode}
              >
                Withdraw
              </Button>
            </ArrivingSoonTooltip>
          </UserDataSkeleton>
        )}
        {featureFlags.DEPOSIT_CAP_ENABLED && <AcreTVLMessage />}
      </HStack>
    </Flex>
  )
}
