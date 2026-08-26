import React from "react"
import { Card, HStack, Icon, Text } from "@chakra-ui/react"
import { IconExclamationCircle } from "@tabler/icons-react"

export default function ProtocolPauseBanner() {
  return (
    <Card px="6" py="6" w="100%" bg="ivoire.10">
      <HStack alignItems="center" spacing={4}>
        <Icon
          as={IconExclamationCircle}
          rounded="full"
          w="9"
          h="9"
          p="2"
          color="orange.50"
          bg="oldPalette.opacity.orange.50.15"
          flexShrink={0}
        />

        <Text size="md" color="text.primary">
          Attention: Deposits Paused and Vault Upgrade Scheduled for Fall 2026.
          Withdrawals Remain Live.
        </Text>
      </HStack>
    </Card>
  )
}
