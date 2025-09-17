import React from "react"
import { AcreLogoIcon } from "#/assets/icons"
import { HStack, Icon, Link } from "@chakra-ui/react"
import { externalHref } from "#/constants"
import ConnectWallet from "./ConnectWallet"

export default function Header() {
  return (
    <HStack
      as="header"
      w="full"
      mx="auto"
      justify="space-between"
      zIndex="header"
      pt="6"
      px="6"
      pb={{ base: 4, xl: 12 }}
    >
      <Link href={externalHref.WEBSITE} isExternal>
        <Icon as={AcreLogoIcon} w={20} h={12} />
      </Link>

      <ConnectWallet />
    </HStack>
  )
}
