import React, { useEffect, useState } from "react"
import { ModalBody, ModalHeader, ModalCloseButton } from "@chakra-ui/react"
import {
  useConnectors,
  useIsEmbed,
  useIsSignedMessage,
  useWallet,
  useWalletConnectionAlert,
} from "#/hooks"
import { OrangeKitConnector, BaseModalProps, OnSuccessCallback } from "#/types"
import { wallets } from "#/constants"
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
    </>
  )
}

const ConnectWalletModal = withBaseModal(ConnectWalletModalBase, {
  returnFocusOnClose: false,
})
export default ConnectWalletModal
