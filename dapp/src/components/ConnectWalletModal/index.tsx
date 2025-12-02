import React, { useEffect, useState } from "react"
import {
  ModalBody,
  ModalHeader,
  ModalCloseButton,
  ModalFooter,
  Link,
  Button,
  Icon,
  Text,
  Box,
  Flex,
  Image,
} from "@chakra-ui/react"
import {
  useConnectors,
  useIsEmbed,
  useIsSignedMessage,
  useWallet,
  useWalletConnectionAlert,
} from "#/hooks"
import { OrangeKitConnector, BaseModalProps, OnSuccessCallback } from "#/types"
import { externalHref, wallets } from "#/constants"
import { IconArrowUpRight } from "@tabler/icons-react"
import tbtcEvmIconSrc from "#/assets/images/tbtc-evm-icon.png"
import evmWalletsLogosSrc from "#/assets/images/evm-wallets-logos.png"
import withBaseModal from "../ModalRoot/withBaseModal"
import ConnectWalletButton from "./ConnectWalletButton"
import ConnectWalletAlert from "./ConnectWalletAlert"

export function ConnectWalletModalBase({
  onSuccess,
  withCloseButton = true,
  isReconnecting,
}: {
  onSuccess?: OnSuccessCallback
  isReconnecting?: boolean
} & BaseModalProps) {
  const { isEmbed } = useIsEmbed()
  const { onDisconnect } = useWallet()
  const connectors = useConnectors()
  const enabledConnectors = connectors.map((connector) => ({
    ...connector,
    isDisabled: !wallets.SUPPORTED_WALLET_IDS.includes(connector.id),
  }))

  const [selectedConnectorId, setSelectedConnectorId] = useState<string>()
  const { type, resetConnectionAlert } = useWalletConnectionAlert()
  const isSignedMessage = useIsSignedMessage()

  const handleButtonOnClick = (connector: OrangeKitConnector) => {
    setSelectedConnectorId(connector.id)
  }

  useEffect(() => {
    if (!isEmbed) return

    setSelectedConnectorId(enabledConnectors[0].id)
  }, [enabledConnectors, isEmbed])

  return (
    <>
      {withCloseButton && (
        <ModalCloseButton
          onClick={() => {
            resetConnectionAlert()

            if (!isSignedMessage) {
              onDisconnect()
            }
          }}
        />
      )}
      <ModalHeader>
        {isEmbed ? "Select your account" : "Connect wallet"}
      </ModalHeader>

      <ModalBody gap={0} pb={{ sm: 0 }}>
        <ConnectWalletAlert type={type} />

        {enabledConnectors.map((connector) => (
          <ConnectWalletButton
            key={connector.id}
            label={connector.name}
            connector={connector}
            onClick={() => handleButtonOnClick(connector)}
            isSelected={selectedConnectorId === connector.id}
            onSuccess={onSuccess}
            isReconnecting={isReconnecting}
          />
        ))}
      </ModalBody>

      <ModalFooter p={{ sm: 0 }} gap={0}>
        <Box p={8} pt={5} w="full">
          <Text size="md" fontWeight="600">
            Having trouble?
          </Text>

          <Text size="md" fontWeight="400">
            Check out our{" "}
            <Button
              as={Link}
              href={externalHref.WALLET_GUIDE}
              isExternal
              variant="link"
              fontWeight="400"
              textDecoration="underline"
              rightIcon={
                <Icon as={IconArrowUpRight} color="oldPalette.brand.400" />
              }
              fontSize="inherit"
            >
              Wallet Guide
            </Button>
          </Text>
        </Box>

        <Flex
          p={8}
          pt={5}
          w="full"
          gap={4}
          bg="surface.3"
          borderBottomRadius="md"
          borderTop={1}
          borderTopColor="white"
        >
          <Image src={tbtcEvmIconSrc} aspectRatio={1} boxSize="44px" />

          <Flex flexFlow="column" align="baseline">
            <Text fontWeight="600" mb={1}>
              Only have an EVM wallet?
            </Text>

            <Text fontWeight="400" mb={5}>
              You can deposit tBTC into Acre via our partner Threshold Network.
            </Text>

            <Button
              href={externalHref.THRESHOLD_ACRE_VAULT}
              isExternal
              as={Link}
              variant="outline"
              leftIcon={<Icon as={IconArrowUpRight} />}
              rightIcon={<Image src={evmWalletsLogosSrc} w={12} h={5} ml={3} />}
              borderColor="brown.30"
            >
              Go to Threshold App
            </Button>
          </Flex>
        </Flex>
      </ModalFooter>
    </>
  )
}

const ConnectWalletModal = withBaseModal(ConnectWalletModalBase, {
  returnFocusOnClose: false,
})
export default ConnectWalletModal
