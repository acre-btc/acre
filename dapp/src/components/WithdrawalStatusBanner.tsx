import React, { useEffect, useMemo, useState } from "react"
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
  "Your withdrawal is being processed. The funds will be released and are expected to arrive in your wallet within approximately 72 hours."

function EstimatedDurationText({ children }: { children: React.ReactNode }) {
  return (
    <Text size="md" color="text.tertiary" ml="auto">
      Est. duration{" "}
      <Text as="span" size="md" color="text.secondary">
        {children}
      </Text>
    </Text>
  )
}

function PendingWithdrawBannerTimeInfo({
  withdrawnAt,
}: {
  withdrawnAt: number
}) {
  const [progress, setProgress] = useState(0)
  const availableAtTimestamp = useMemo(
    () => withdrawnAt + 3 * time.ONE_DAY_IN_SECONDS,
    [withdrawnAt],
  )

  const isDeadlinePassed = useMemo(
    () => availableAtTimestamp <= timeUtils.dateToUnixTimestamp(),
    [availableAtTimestamp],
  )

  const { days, hours, minutes } = useCountdown(availableAtTimestamp, false)
  const totalHours = Number(days) * 24 + Number(hours)

  useEffect(() => {
    if (isDeadlinePassed) return () => {}

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
  }, [withdrawnAt, availableAtTimestamp, isDeadlinePassed])

  if (isDeadlinePassed)
    return (
      <EstimatedDurationText>
        {activitiesUtils.getEstimatedDuration(
          // There’s no need to pass an amount for the `withdraw` activity, as
          // the timing doesn’t depend on the amount.
          0n,
          "withdraw",
          undefined,
          "requested",
        )}
      </EstimatedDurationText>
    )

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
      <EstimatedDurationText>
        {totalHours !== 0 && `${hours}h`}
        {minutes !== "0" && `${minutes}m`}
      </EstimatedDurationText>
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
            <Text>Withdrawal in Progress</Text>
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
          </Text>
        </VStack>

        {status === "requested" && (
          <PendingWithdrawBannerTimeInfo withdrawnAt={withdrawnAt} />
        )}
        {status === "pending" && (
          <EstimatedDurationText>
            {activitiesUtils.getEstimatedDuration(
              btcAmount,
              "withdraw",
              undefined,
              status,
            )}
          </EstimatedDurationText>
        )}
      </HStack>
    </Card>
  )
}
