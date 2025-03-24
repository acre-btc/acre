import React from "react"
import { AlertStatus, Box, Link, VStack } from "@chakra-ui/react"
import { AnimatePresence, Variants, motion } from "framer-motion"
import { externalHref } from "#/constants"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  AlertIcon,
  AlertProps,
} from "../Alert"

export enum ConnectionAlert {
  Rejected = "REJECTED",
  NotSupported = "NOT_SUPPORTED",
  NetworkMismatch = "NETWORK_MISMATCH",
  InvalidSIWWSignature = "INVALID_SIWW_SIGNATURE",
  Default = "DEFAULT",
}

type ConnectionAlertData = {
  title: string
  description?: React.ReactNode
  status?: AlertStatus
  colorScheme?: string
}

type ConnectionAlerts = Record<ConnectionAlert, ConnectionAlertData>

function ContactSupport() {
  return (
    <Box as="span">
      If the problem persists, contact{" "}
      <Link
        // TODO: Define in the new color palette
        color="#0E61FE"
        textDecoration="underline"
        href={externalHref.DISCORD}
        isExternal
      >
        Acre support
      </Link>
      .
    </Box>
  )
}

const CONNECTION_ALERTS: ConnectionAlerts = {
  [ConnectionAlert.Rejected]: {
    title: "Please connect your wallet to start using Acre",
    status: "info",
    colorScheme: "oldPalette.blue",
  },
  [ConnectionAlert.NotSupported]: {
    title: "Not supported.",
    description:
      "Only Native SegWit, Nested SegWit, or Legacy addresses are supported. Please use a compatible address or switch to a different wallet.",
  },
  [ConnectionAlert.NetworkMismatch]: {
    title: "Incorrect network detected in your wallet.",
    description:
      "Please connect your wallet to the correct Bitcoin network and try again.",
  },
  [ConnectionAlert.Default]: {
    title: "Wallet connection failed. Please try again.",
    description: <ContactSupport />,
  },
  [ConnectionAlert.InvalidSIWWSignature]: {
    title: "Invalid sign-in signature. Please try again.",
    description: <ContactSupport />,
  },
}

const collapseVariants: Variants = {
  collapsed: { height: 0 },
  expanded: { height: "auto" },
}

type ConnectWalletAlertProps = Omit<AlertProps, "status"> & {
  type?: ConnectionAlert
}

export default function ConnectWalletAlert(props: ConnectWalletAlertProps) {
  const { type, ...restProps } = props

  const {
    status = "error",
    title,
    description,
    ...restData
  } = (type ? CONNECTION_ALERTS[type] : {}) as ConnectionAlertData

  return (
    <AnimatePresence initial={false}>
      {type && (
        <Box
          as={motion.div}
          variants={collapseVariants}
          initial="collapsed"
          animate="expanded"
          exit="collapsed"
          overflow="hidden"
          w="full"
        >
          <Alert status={status} mb={6} {...restProps} {...restData}>
            <AlertIcon />
            <VStack w="full" align="start" spacing={0}>
              <AlertTitle textAlign="start">{title}</AlertTitle>
              {description && (
                <AlertDescription>{description}</AlertDescription>
              )}
            </VStack>
          </Alert>
        </Box>
      )}
    </AnimatePresence>
  )
}
