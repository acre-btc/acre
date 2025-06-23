import React from "react"
import {
  Alert as ChakraAlert,
  Icon,
  type AlertProps,
  AlertTitle,
  AlertDescription,
  AlertStatus,
  useAlertStyles,
} from "@chakra-ui/react"
import {
  IconCircleCheck,
  IconExclamationCircle,
  IconInfoCircle,
} from "@tabler/icons-react"
import Spinner from "./Spinner"

// It's impossible to customize AlertIcon in Chakra UI, this component serves
// as a workaround
// Ref: https://github.com/chakra-ui/chakra-ui/discussions/5997#discussioncomment-4098525

const STATUSES = {
  info: {
    icon: IconInfoCircle,
    colorScheme: "oldPalette.gold",
  },
  warning: {
    icon: IconExclamationCircle,
    colorScheme: "oldPalette.orange",
  },
  success: {
    icon: IconCircleCheck,
    colorScheme: "oldPalette.green",
  },
  error: {
    icon: IconExclamationCircle,
    colorScheme: "oldPalette.red",
  },
  loading: {
    icon: Spinner,
    colorScheme: "oldPalette.brand",
  },
}

const getStatusColorScheme = (status: AlertStatus) =>
  STATUSES[status].colorScheme

const getStatusIcon = (status: AlertStatus) => STATUSES[status].icon

function AlertIcon(props: AlertProps) {
  const { status = "info", as } = props
  const icon = as ?? getStatusIcon(status)
  const styles = useAlertStyles()
  const css =
    status === "loading"
      ? {
          ...styles.spinner,
          ...styles.icon,
          color: `${getStatusColorScheme(status)}.400`,
        }
      : styles.icon

  return (
    <Icon
      as={icon}
      __css={css}
      variant={status === "loading" ? "filled" : undefined}
    />
  )
}

export default function Alert(props: AlertProps) {
  const { status = "info", children, ...restProps } = props
  const colorScheme = getStatusColorScheme(status)

  return (
    <ChakraAlert colorScheme={colorScheme} {...restProps}>
      {children}
    </ChakraAlert>
  )
}

export { Alert, AlertIcon, AlertTitle, AlertDescription, type AlertProps }
