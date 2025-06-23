import React, { useCallback, useEffect, useRef, useState } from "react"
import { time } from "#/constants"
import {
  useAppDispatch,
  useIsEmbed,
  useModal,
  usePostHogIdentity,
  useSignMessageAndCreateSession,
  useWallet,
  useWalletConnectionAlert,
} from "#/hooks"
import { setIsSignedMessage } from "#/store/wallet"
import { OrangeKitConnector, OrangeKitError, OnSuccessCallback } from "#/types"
import { eip1193, logPromiseFailure, orangeKit } from "#/utils"
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Icon,
  Image,
  ImageProps,
  VStack,
  Text,
} from "@chakra-ui/react"
import { IconArrowNarrowRight } from "@tabler/icons-react"
import { AnimatePresence, Variants, motion } from "framer-motion"
import ArrivingSoonTooltip from "../ArrivingSoonTooltip"
import ConnectWalletStatusLabel from "./ConnectWalletStatusLabel"
import Spinner from "../Spinner"
import { ConnectionAlert } from "./ConnectWalletAlert"

type ConnectWalletButtonProps = {
  label: string
  onClick: () => void
  isSelected: boolean
  connector: OrangeKitConnector & { isDisabled: boolean }
  onSuccess?: OnSuccessCallback
  isReconnecting?: boolean
}

const iconStyles: Record<string, ImageProps> = {
  "orangekit-unisat": {
    p: 0.5,
  },
}

const collapseVariants: Variants = {
  collapsed: { height: 0 },
  expanded: { height: "auto" },
}

export default function ConnectWalletButton({
  label,
  onClick,
  isSelected,
  connector,
  onSuccess,
  isReconnecting,
}: ConnectWalletButtonProps) {
  const { isEmbed } = useIsEmbed()
  const {
    address,
    onConnect,
    onDisconnect,
    status: connectionStatus,
  } = useWallet()
  const { signMessageStatus, resetMessageStatus, signMessageAndCreateSession } =
    useSignMessageAndCreateSession()
  const { type, setConnectionAlert, resetConnectionAlert } =
    useWalletConnectionAlert()
  const { closeModal } = useModal()
  const dispatch = useAppDispatch()
  const isMounted = useRef(false)
  const { handleIdentification } = usePostHogIdentity()

  const [isLoading, setIsLoading] = useState<boolean>(false)

  const hasConnectionError = type || connectionStatus === "error"
  const hasSignMessageErrorStatus = signMessageStatus === "error"
  const shouldShowStatuses = isSelected && !hasConnectionError
  const shouldShowRetryButton = address && hasSignMessageErrorStatus

  const onSuccessSignMessage = useCallback(() => {
    closeModal()
    dispatch(setIsSignedMessage(true))

    if (onSuccess) {
      onSuccess()
    }
  }, [closeModal, dispatch, onSuccess])

  const handleSignMessageAndCreateSession = useCallback(
    async (connectedConnector: OrangeKitConnector, btcAddress: string) => {
      try {
        await signMessageAndCreateSession(connectedConnector, btcAddress)

        onSuccessSignMessage()
      } catch (error) {
        if (eip1193.didUserRejectRequest(error)) return

        onDisconnect()
        console.error("Failed to sign siww message", error)
        setConnectionAlert(ConnectionAlert.InvalidSIWWSignature)
      }
    },
    [
      signMessageAndCreateSession,
      onSuccessSignMessage,
      onDisconnect,
      setConnectionAlert,
    ],
  )

  const onSuccessConnection = useCallback(
    async (connectedConnector: OrangeKitConnector) => {
      const btcAddress: string = await connectedConnector.getBitcoinAddress()

      if (!btcAddress) return

      await handleSignMessageAndCreateSession(connector, btcAddress)
      handleIdentification(btcAddress, {
        connector: connectedConnector.id,
      })
    },
    [connector, handleSignMessageAndCreateSession, handleIdentification],
  )

  const handleConnection = useCallback(() => {
    onConnect(connector, {
      isReconnecting,
      onSuccess: () => {
        logPromiseFailure(onSuccessConnection(connector))
      },
      onError: (error: OrangeKitError) => {
        const errorData = orangeKit.parseOrangeKitConnectionError(error)

        if (errorData === ConnectionAlert.Default) {
          console.error("Failed to connect", error)
        }

        setConnectionAlert(errorData)
      },
    })
  }, [
    onConnect,
    connector,
    onSuccessConnection,
    setConnectionAlert,
    isReconnecting,
  ])

  const handleRedirectUser = useCallback(() => {
    setIsLoading(true)

    setTimeout(() => {
      const wallet = orangeKit.getWalletInfo(connector)

      if (wallet) {
        window.open(wallet.downloadUrls.desktop, "_blank")?.focus()
      }

      setIsLoading(false)
    }, time.ONE_SEC_IN_MILLISECONDS * 2)
  }, [connector])

  const handleButtonClick = () => {
    // Do not trigger action again when wallet connection is in progress
    if (shouldShowStatuses) return

    if (!isReconnecting) onDisconnect()
    resetConnectionAlert()
    resetMessageStatus()

    const isInstalled = orangeKit.isWalletInstalled(connector)

    if (!isInstalled) {
      handleRedirectUser()
      return
    }

    onClick()
    handleConnection()
  }

  useEffect(() => {
    if (!isMounted.current && isEmbed && isSelected) {
      isMounted.current = true
      handleConnection()
    }
  }, [handleConnection, isEmbed, isSelected])

  return (
    <Card
      key={connector.id}
      alignSelf="stretch"
      borderWidth={1}
      borderColor="surface.4"
      rounded="sm"
      mb={3}
      _last={{ mb: 0 }}
      p={0}
    >
      <CardHeader>
        <ArrivingSoonTooltip shouldDisplayTooltip={connector.isDisabled}>
          <Button
            variant="ghost"
            boxSize="full"
            justifyContent="start"
            p={6}
            onClick={handleButtonClick}
            leftIcon={
              <Image
                src={connector.icon}
                boxSize={6}
                bg="black"
                rounded="xs"
                {...iconStyles[connector.id]}
              />
            }
            rightIcon={
              !isLoading ? (
                <Icon as={IconArrowNarrowRight} boxSize={6} ml="auto" />
              ) : (
                <Spinner boxSize={6} variant="filled" />
              )
            }
            iconSpacing={4}
            isDisabled={connector.isDisabled}
          >
            <Text size="lg" flex={1} textAlign="start" fontWeight="semibold">
              {label}
            </Text>
          </Button>
        </ArrivingSoonTooltip>
      </CardHeader>

      <AnimatePresence initial={false}>
        {shouldShowStatuses && (
          <CardBody
            as={motion.div}
            variants={collapseVariants}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            overflow="hidden"
            sx={{ flex: undefined }} // To override the default flex: 1
          >
            <VStack
              p={6}
              pt={4}
              borderTopWidth={1}
              borderStyle="solid"
              borderColor="surface.4"
              align="start"
            >
              <Flex direction="column" gap={2} w="full">
                <Text size="md" fontWeight="bold" textAlign="start">
                  Requires 2 actions:
                </Text>
                <ConnectWalletStatusLabel
                  status={connectionStatus}
                  label={`Connect ${isEmbed ? "account" : "wallet"}`}
                />
                <ConnectWalletStatusLabel
                  status={signMessageStatus}
                  label="Sign message"
                />
                {shouldShowRetryButton && (
                  <Button
                    mt={4}
                    size="lg"
                    variant="outline"
                    onClick={() =>
                      logPromiseFailure(
                        handleSignMessageAndCreateSession(connector, address),
                      )
                    }
                  >
                    Resume and try again
                  </Button>
                )}
              </Flex>
            </VStack>
          </CardBody>
        )}
      </AnimatePresence>
    </Card>
  )
}
