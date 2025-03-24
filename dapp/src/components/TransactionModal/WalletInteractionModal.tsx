import React from "react"
import {
  AlertDescription,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  Image,
  HStack,
  Progress,
  ProgressProps,
  Text,
} from "@chakra-ui/react"
import { AcreSignIcon } from "#/assets/icons"
import { useActionFlowType, useConnector, useIsEmbed } from "#/hooks"
import { ACTION_FLOW_TYPES, DappMode } from "#/types"
import { Alert, AlertIcon } from "../Alert"

const ICON_STYLES = {
  boxSize: 14,
  rounded: "full",
}

type WalletInteractionStep = "opening-wallet" | "awaiting-transaction"

const CONTENT_BY_DAPP_MODE: Record<DappMode, string> = {
  standalone: "wallet",
  "ledger-live": "Ledger Device",
}

const DATA: Record<
  WalletInteractionStep,
  {
    header: string
    description: (action: string, mode: DappMode) => string
    progressProps?: ProgressProps
  }
> = {
  "opening-wallet": {
    header: "Opening your wallet for signature",
    description: (action) =>
      `Confirm the ${action} by signing the transaction with your wallet.`,
  },
  "awaiting-transaction": {
    header: "Awaiting signature confirmation",
    description: (_, mode: DappMode) =>
      `Communicating with your ${CONTENT_BY_DAPP_MODE[mode]}...`,
    progressProps: { transform: "scaleX(-1)" },
  },
}

export default function WalletInteractionModal({
  step,
  onClose,
}: {
  step: WalletInteractionStep
  onClose?: () => void
}) {
  const actionType = useActionFlowType()
  const connector = useConnector()
  const { header, description, progressProps } = DATA[step]
  const { embeddedApp } = useIsEmbed()

  return (
    <>
      {step === "opening-wallet" && <ModalCloseButton onClick={onClose} />}
      <ModalHeader textAlign="center" pt={{ sm: 16 }} pb={{ base: 4, sm: 12 }}>
        {header}
      </ModalHeader>
      <ModalBody gap={12}>
        <HStack minW={80} spacing={5}>
          <AcreSignIcon {...ICON_STYLES} />
          {/* TODO: Create correct progress bar */}
          <Progress
            size="sm"
            bg="surface.3"
            isIndeterminate
            {...progressProps}
          />
          <Image
            src={connector?.icon}
            p={2}
            bg="black"
            alt="Connector icon"
            {...ICON_STYLES}
          />
        </HStack>
        <Text size="md">
          {description(
            actionType === ACTION_FLOW_TYPES.STAKE ? "deposit" : "withdraw",
            embeddedApp ?? "standalone",
          )}
        </Text>
        {step === "awaiting-transaction" && (
          <Alert variant="elevated">
            <AlertIcon />
            <AlertDescription>
              <Text size="md">This may take up to a minute.</Text>
            </AlertDescription>
          </Alert>
        )}
      </ModalBody>
    </>
  )
}
