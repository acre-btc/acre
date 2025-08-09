import React from "react"
import {
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalHeader,
  VStack,
  Text,
} from "@chakra-ui/react"
import { LoadingSpinnerSuccessIcon } from "#/assets/icons"
import { useActionFlowTokenAmount, useActionFlowTxHash } from "#/hooks"
import CurrencyBalanceWithConversion from "#/components/shared/CurrencyBalanceWithConversion"
import { ACTION_FLOW_TYPES, ActionFlowType } from "#/types"
import { activitiesUtils } from "#/utils"
import { Alert, AlertIcon, AlertDescription } from "#/components/shared/Alert"
import BlockExplorerLink from "../shared/BlockExplorerLink"

type SuccessModalProps = {
  type: ActionFlowType
}

export default function SuccessModal({ type }: SuccessModalProps) {
  const tokenAmount = useActionFlowTokenAmount()
  const txHash = useActionFlowTxHash()

  // TODO: We should use one type for flow and activity
  const activityType = type === ACTION_FLOW_TYPES.STAKE ? "deposit" : "withdraw"

  return (
    <>
      <ModalCloseButton />
      <ModalHeader textAlign="center" pt={{ sm: 16 }}>
        {ACTION_FLOW_TYPES.UNSTAKE === type
          ? "Withdrawal initiated!"
          : "Deposit received!"}
      </ModalHeader>
      <ModalBody gap={10}>
        <VStack gap={4}>
          <LoadingSpinnerSuccessIcon boxSize={14} />

          {tokenAmount && (
            <VStack spacing={0} mb={9}>
              <CurrencyBalanceWithConversion
                from={{
                  currency: tokenAmount.currency,
                  amount: tokenAmount.amount.toString(),
                  size: "4xl",
                  fontWeight: "semibold",
                }}
                to={{
                  currency: "usd",
                  size: "md",
                  fontWeight: "medium",
                }}
              />
            </VStack>
          )}
          {ACTION_FLOW_TYPES.UNSTAKE === type && (
            <Text size="md">
              Funds will arrive in your wallet once the withdrawal is complete.
              Track progress in your dashboard.
            </Text>
          )}
          {ACTION_FLOW_TYPES.STAKE === type && txHash && (
            <BlockExplorerLink
              id={txHash}
              type="transaction"
              chain="bitcoin"
              text="View on Mempool"
            />
          )}
        </VStack>
      </ModalBody>
      <ModalFooter pt={2}>
        <Alert variant="elevated">
          <AlertIcon status="loading" />
          <AlertDescription>
            <Text size="sm">You can close this window.</Text>
            <Text size="sm">The process will continue in the background.</Text>
            <Text size="sm" color="#7D6A4B">
              Estimated duration&nbsp; ~{" "}
              {activitiesUtils.getEstimatedDuration(
                tokenAmount?.amount ?? 0n,
                activityType,
              )}
            </Text>
          </AlertDescription>
        </Alert>
      </ModalFooter>
    </>
  )
}
