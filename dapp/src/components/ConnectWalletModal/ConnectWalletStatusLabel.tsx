import React from "react"
import { Status } from "#/types"
import { Box, HStack, Icon, Text } from "@chakra-ui/react"
import {
  IconCircleCheck,
  IconCircleX,
  IconInfoCircle,
} from "@tabler/icons-react"
import Spinner from "../Spinner"

const statusToLabelProps: Record<Status, { color: string }> = {
  idle: {
    color: "text.tertiary",
  },
  pending: {
    color: "acre.50",
  },
  error: {
    color: "text.tertiary",
  },
  success: {
    color: "text.primary",
  },
}

const boxSize = 5
const statusToIcon: Record<Status, React.ReactNode> = {
  idle: <Box boxSize={boxSize} />,
  pending: <Spinner boxSize={boxSize} />,
  error: <Icon as={IconCircleX} boxSize={boxSize} color="text.tertiary" />,
  success: <Icon as={IconCircleCheck} boxSize={boxSize} color="green.50" />,
}

type ConnectWalletStatusLabelProps = {
  label: string
  status: Status
}

export default function ConnectWalletStatusLabel({
  status,
  label,
}: ConnectWalletStatusLabelProps) {
  const isError = status === "error"
  const icon = statusToIcon[status]

  return (
    <HStack spacing={3}>
      <HStack textAlign="start">
        {icon}
        <Text size="md" {...statusToLabelProps[status]}>
          {label}
        </Text>
      </HStack>
      {isError && (
        <HStack color="red.50" textAlign="start">
          <Icon as={IconInfoCircle} boxSize={boxSize} />
          <Text size="md">Rejected by user</Text>
        </HStack>
      )}
    </HStack>
  )
}
