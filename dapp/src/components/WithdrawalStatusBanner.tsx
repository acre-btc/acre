import React, { ComponentType, useEffect, useState } from "react"
import { Button, Card, HStack, Icon, Text, VStack } from "@chakra-ui/react"
import { IconHourglassEmpty, IconArrowUp } from "@tabler/icons-react"
import {
  useCountdown,
  useCurrencyConversion,
  useTransactionModal,
} from "#/hooks"
import { numbersUtils, timeUtils } from "#/utils"
import { time } from "#/constants"
import { ACTION_FLOW_TYPES } from "#/types"
import ProgressBar from "./shared/ProgressBar"
import CurrencyBalance from "./shared/CurrencyBalance"
import TooltipIcon from "./shared/TooltipIcon"

export type WithdrawStatus = "pending" | "ready"

const STATUS: Record<
  WithdrawStatus,
  {
    icon: ComponentType
    title: string
    iconPros: { color: string; bg: string }
  }
> = {
  pending: {
    icon: IconHourglassEmpty,
    iconPros: { color: "orange.50", bg: "oldPalette.opacity.orange.50.15" },
    title: "Withdrawal Request in Progress",
  },
  ready: {
    icon: IconArrowUp,
    iconPros: { color: "green.50", bg: "oldPalette.opacity.green.50.15" },
    title: "Funds Ready to Transfer",
  },
}

const PENDING_STATE_TOOLTIP_CONTENT =
  "Your withdrawal request has been submitted and is now being processed. The requested funds will be available for withdrawal in approximately 72 hours."

function PendingWithdrawBannerTimeInfo({
  withdrawnAt,
}: {
  withdrawnAt: number
}) {
  const [progress, setProgress] = useState(0)
  const availableAtTimestamp = withdrawnAt + 3 * time.ONE_DAY_IN_SECONDS

  const { days, hours, minutes } = useCountdown(availableAtTimestamp, false)

  useEffect(() => {
    function updateProgress() {
      const now = timeUtils.dateToUnixTimestamp()
      const total = availableAtTimestamp - withdrawnAt
      const elapsed = now - withdrawnAt

      const percentage = Math.min(100, Math.max(0, (elapsed / total) * 100))
      setProgress(percentage)
    }

    // Initial update
    updateProgress()

    const interval = setInterval(
      updateProgress,
      time.ONE_MINUTE_IN_SECONDS * time.ONE_SEC_IN_MILLISECONDS,
    )

    return () => clearInterval(interval)
  }, [withdrawnAt, availableAtTimestamp])

  return (
    <VStack ml="auto">
      <ProgressBar
        value={progress}
        hasStripe={false}
        size="md"
        bgColor="oldPalette.opacity.orange.50.15"
        maxW="160px"
        marginLeft="auto"
      />
      <Text size="md" color="text.tertiary">
        Est. duration{" "}
        <Text as="span" size="md" color="text.secondary">
          {days !== "0" && `${days}d`}
          {hours !== "0" && `, ${hours}h`}
          {minutes !== "0" && days === "0" && hours === "0" && `${minutes}m`}
        </Text>
      </Text>
    </VStack>
  )
}

export default function WithdrawalStatusBanner({
  status,
  btcAmount,
  withdrawnAt,
}: {
  status: WithdrawStatus
  btcAmount: bigint
  withdrawnAt: number
}) {
  const usdAmount = useCurrencyConversion({
    from: { currency: "bitcoin", amount: btcAmount },
    to: { currency: "usd" },
  })
  const openWithdrawModal = useTransactionModal(ACTION_FLOW_TYPES.UNSTAKE)
  const iconProps = STATUS[status].iconPros

  return (
    <Card px="6" py="6" w="100%" bg="ivoire.10">
      <HStack alignItems="center" spacing={4}>
        <Icon
          as={STATUS[status].icon}
          rounded="full"
          w="9"
          h="9"
          p="2"
          {...iconProps}
        />

        <VStack alignItems="flex-start" spacing={0}>
          <Text
            size="md"
            color={status === "ready" ? "green.50" : undefined}
            as={HStack}
            spacing="2"
          >
            <Text>{STATUS[status].title}</Text>
            {status === "pending" && (
              <TooltipIcon
                as="div"
                label={PENDING_STATE_TOOLTIP_CONTENT}
                placement="right"
                iconColor="brown.40"
                maxW={220}
              />
            )}
          </Text>
          <Text size="md" as="div" color="text.primary" fontWeight="400">
            <CurrencyBalance
              currency="bitcoin"
              amount={btcAmount}
              size="md"
              fontWeight="400"
              color="text.primary"
            />
            <Text size="md" color="text.tertiary" as="span" fontWeight="400">
              {" ($"}
              {numbersUtils.numberToLocaleString(usdAmount ?? 0, 2)}
              {") "}
            </Text>
            {status === "pending" && "being withdrawn."}
          </Text>
        </VStack>

        {status === "pending" && (
          <PendingWithdrawBannerTimeInfo withdrawnAt={withdrawnAt} />
        )}
        {status === "ready" && (
          <Text size="md" color="text.tertiary" ml="auto">
            Est. duration{" "}
            <Text as="span" color="text.secondary">
              ~6h
            </Text>
          </Text>
        )}
        {status === "ready" && (
          // TODO: We do not support the color schema in button theme. Do we
          // want to add it or can we use `outline` variant? Or we can use solid
          // variant with acre brand color.
          <Button variant="outline" onClick={openWithdrawModal}>
            Withdraw Funds
          </Button>
        )}
      </HStack>
    </Card>
  )
}
