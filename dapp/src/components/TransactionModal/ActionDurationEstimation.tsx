import React from "react"
import { ActivityType } from "#/types"
import { activitiesUtils } from "#/utils"
import { useFormField } from "#/hooks"
import { HStack, Text } from "@chakra-ui/react"
import { TOKEN_AMOUNT_FIELD_NAME } from "../shared/TokenAmountForm/TokenAmountFormBase"
import TooltipIcon from "../shared/TooltipIcon"

const TOOLTIP_CONTENT =
  "Withdrawals are processed in the order they're requested. Completion can take up to 72 hours, depending on request volume, network conditions, and security checks."

export default function ActionDurationEstimation({
  type,
}: {
  type: ActivityType
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
        ~
        {activitiesUtils.getEstimatedDuration(
          amount,
          type,
          type === "withdraw",
        )}
      </Text>
      {type === "withdraw" && (
        <TooltipIcon label={TOOLTIP_CONTENT} maxW={220} placement="right" />
      )}
    </Text>
  )
}
