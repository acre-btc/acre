import React, { useEffect, useState } from "react"
import { Card, HStack, Icon, Text, VStack } from "@chakra-ui/react"
import { IconHourglassEmpty } from "@tabler/icons-react"
import { useCountdown, useCurrencyConversion } from "#/hooks"
import { activitiesUtils, numbersUtils, timeUtils } from "#/utils"
import { time } from "#/constants"
import { Activity } from "#/types"
import ProgressBar from "./shared/ProgressBar"
import CurrencyBalance from "./shared/CurrencyBalance"
import TooltipIcon from "./shared/TooltipIcon"

export type WithdrawStatus = Extract<
  Activity["status"],
  "pending" | "requested"
>

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

  return (
    <Card px="6" py="6" w="100%" bg="ivoire.10">
      <HStack alignItems="center" spacing={4}>
        <Icon
          as={IconHourglassEmpty}
          rounded="full"
          w="9"
          h="9"
          p="2"
          color="orange.50"
          bg="oldPalette.opacity.orange.50.15"
        />

        <VStack alignItems="flex-start" spacing={0}>
          <Text size="md" as={HStack} spacing="2">
            <Text>Withdrawal Request in Progress</Text>
            {status === "requested" && (
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

        {status === "requested" && (
          <PendingWithdrawBannerTimeInfo withdrawnAt={withdrawnAt} />
        )}
        {status === "pending" && (
          <Text size="md" color="text.tertiary" ml="auto">
            Est. duration{" "}
            <Text as="span" color="text.secondary">
              {activitiesUtils.getEstimatedDuration(
                btcAmount,
                "withdraw",
                undefined,
                status,
              )}
            </Text>
          </Text>
        )}
      </HStack>
    </Card>
  )
}
