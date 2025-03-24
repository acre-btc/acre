import React from "react"
import { useAppDispatch, useMinWithdrawAmount } from "#/hooks"
import {
  AlertDescription,
  Button,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  VStack,
  Text,
} from "@chakra-ui/react"
import { setStatus } from "#/store/action-flow"
import { PROCESS_STATUSES } from "#/types"
import { BitcoinsStackErrorIcon } from "#/assets/icons"
import CurrencyBalance from "#/components/CurrencyBalance"
import { Alert, AlertIcon } from "#/components/Alert"

export default function NotEnoughFundsModal() {
  const dispatch = useAppDispatch()
  const minWithdrawAmount = useMinWithdrawAmount()

  const handleWithdrawAll = () => {
    dispatch(setStatus(PROCESS_STATUSES.REFINE_AMOUNT))
  }
  const handleContinue = () => {
    dispatch(setStatus(PROCESS_STATUSES.PENDING))
  }

  return (
    <>
      <ModalCloseButton />
      <ModalHeader
        as={Text}
        size="xl"
        textAlign="center"
        color="red.50"
        fontWeight="bold"
      >
        Not enough funds left for future withdrawals
      </ModalHeader>
      <ModalBody>
        <BitcoinsStackErrorIcon />

        <Text size="md" color="text.primary" px={1}>
          After this withdrawal, your balance will fall below the{" "}
          <CurrencyBalance
            amount={minWithdrawAmount}
            currency="bitcoin"
            as="span"
          />{" "}
          minimum required to initiate a withdrawal. Subsequent withdrawals will
          not be possible until a new deposit is made.
        </Text>

        <Alert status="info" variant="elevated">
          <AlertIcon />
          <AlertDescription>
            Your current withdrawal won&apos;t be impacted; only future
            withdrawals are affected.
          </AlertDescription>
        </Alert>

        <VStack spacing={3} align="stretch" w="full">
          <Button size="lg" onClick={handleWithdrawAll}>
            Withdraw all funds
          </Button>
          <Button size="lg" variant="outline" onClick={handleContinue}>
            I understand and I want to continue
          </Button>
        </VStack>
      </ModalBody>
    </>
  )
}
