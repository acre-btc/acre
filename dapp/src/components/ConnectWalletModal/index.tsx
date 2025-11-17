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

      <ModalBody gap={0}>
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
      <ModalFooter display="block">
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
      </ModalFooter>
    </>
  )
}

const ConnectWalletModal = withBaseModal(ConnectWalletModalBase, {
  returnFocusOnClose: false,
})
export default ConnectWalletModal
