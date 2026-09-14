import React from "react"
import { ActivityType, WithdrawalDestination } from "#/types"
import { activitiesUtils } from "#/utils"
import { useFormField } from "#/hooks"
import { HStack, Text } from "@chakra-ui/react"
import { TOKEN_AMOUNT_FIELD_NAME } from "../shared/TokenAmountForm/TokenAmountFormBase"
import TooltipIcon from "../shared/TooltipIcon"

const BITCOIN_TOOLTIP_CONTENT = `Withdrawals to Bitcoin are redeemed through the tBTC protocol. Completion usually takes around ${activitiesUtils.getWithdrawalDuration()}, depending on network conditions and security checks.`

const TBTC_TOOLTIP_CONTENT =
  "Withdrawals paid out in tBTC are redeemed straight from the acreBTC contract and settle in the same transaction, so there is no waiting period beyond the Ethereum transaction itself."

export default function ActionDurationEstimation({
  type,
  withdrawalDestination = "bitcoin",
}: {
  type: ActivityType
  withdrawalDestination?: WithdrawalDestination["type"]
}) {
  const { value: amount = 0n } = useFormField<bigint | undefined>(
    TOKEN_AMOUNT_FIELD_NAME,
  )

  return (
    <Text
      size="md"
      as={HStack}
      mt={4}
      color="text.tertiary"
      justifyContent="center"
      alignItems="center"
      spacing={2}
    >
      <Text>Estimated duration</Text>
      <Text size="md" color="text.primary">
        {activitiesUtils.getEstimatedDuration(
          amount,
          type,
          withdrawalDestination,
        )}
      </Text>
      {type === "withdraw" && (
        <TooltipIcon
          label={
            withdrawalDestination === "tbtc"
              ? TBTC_TOOLTIP_CONTENT
              : BITCOIN_TOOLTIP_CONTENT
          }
          maxW={220}
          placement="right"
        />
      )}
    </Text>
  )
}
