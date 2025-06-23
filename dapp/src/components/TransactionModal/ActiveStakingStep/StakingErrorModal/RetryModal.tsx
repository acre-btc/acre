import React, { useMemo } from "react"
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import { CableWithPlugIcon } from "#/assets/icons"
import IconWrapper from "#/components/IconWrapper"
import { timeUtils, numbersUtils } from "#/utils"
import { useCountdown } from "#/hooks"
import { time } from "#/constants"
import { IconShieldCheckFilled, IconX } from "@tabler/icons-react"
import Skeleton from "#/components/Skeleton"

const getCounterData = (minutes: string, seconds: string) => {
  const isLessThanMinute = parseInt(minutes, 10) <= 0

  const progressPercent = `${
    isLessThanMinute
      ? numbersUtils.getPercentValue(
          parseInt(seconds, 10),
          time.ONE_MINUTE_IN_SECONDS,
        )
      : 100
  }%`
  const label = `${isLessThanMinute ? "0" : "1"}:${seconds}`

  return { label, progressPercent }
}

type RetryModalProps = { isLoading: boolean; retry: () => void }

export default function RetryModal({ isLoading, retry }: RetryModalProps) {
  const retryTimestamp = useMemo(
    () =>
      timeUtils.getExpirationTimestamp(
        time.ONE_MINUTE_IN_SECONDS * time.ONE_SEC_IN_MILLISECONDS,
      ),
    [],
  )
  const { minutes, seconds } = useCountdown(retryTimestamp, true, retry)

  const { label, progressPercent } = getCounterData(minutes, seconds)

  return (
    <>
      <ModalHeader as={Flex} color="red.50" justifyContent="center">
        <Skeleton isLoaded={!isLoading} w="fit-content">
          Oops! There was an error.
        </Skeleton>
      </ModalHeader>
      <ModalBody gap={10} pt={2} pb={6}>
        <Skeleton isLoaded={!isLoading} borderRadius="50%">
          <IconWrapper icon={CableWithPlugIcon} boxSize={32} color="red.50">
            <Icon as={IconX} color="red.50" boxSize={14} strokeWidth={1} />
          </IconWrapper>
        </Skeleton>
        <Flex flexDirection="column" alignItems="center">
          <Skeleton isLoaded={!isLoading}>
            <Text size="md">No worries—your funds are safe.</Text>
          </Skeleton>
          <Skeleton isLoaded={!isLoading} mt={2}>
            <Text size="md">
              An error occurred while processing your transaction.
            </Text>
          </Skeleton>
        </Flex>
        {isLoading ? (
          <Text size="md" fontWeight="semibold">
            Retrying transaction...
          </Text>
        ) : (
          <HStack gap={1}>
            <Text size="md">Auto-retry in</Text>
            <Text size="md" fontWeight="bold" textAlign="left" minW={10}>
              {label}
            </Text>
            <Box
              w={3}
              h={3}
              aspectRatio={1}
              borderRadius="50%"
              background={`conic-gradient(var(--chakra-colors-acre-50) ${progressPercent}, transparent 0)`}
              transition="background"
            />
            <Box />
          </HStack>
        )}
      </ModalBody>
      <ModalFooter pt={0} pb={8}>
        <Button size="lg" width="100%" onClick={retry} isLoading={isLoading}>
          Retry transaction
        </Button>
        <HStack>
          <Icon as={IconShieldCheckFilled} boxSize={5} color="acre.50" />
          <Text size="sm" color="text.primary">
            Your funds are secure.
          </Text>
        </HStack>
      </ModalFooter>
    </>
  )
}
