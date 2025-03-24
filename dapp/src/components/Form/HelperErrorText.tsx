import React from "react"
import { FormErrorMessage, FormHelperText, Icon } from "@chakra-ui/react"
import { IconInfoCircle } from "@tabler/icons-react"
import { Alert, AlertIcon, AlertDescription } from "../Alert"

export type HelperErrorTextProps = {
  errorMsgText?: string | JSX.Element
  hasError?: boolean
  helperText?: string | JSX.Element
}

export default function HelperErrorText({
  helperText,
  errorMsgText,
  hasError,
}: HelperErrorTextProps) {
  if (hasError) {
    return (
      <FormErrorMessage>
        <Alert status="error">
          <AlertIcon status="error" />
          <AlertDescription>
            {errorMsgText || "Please enter a valid value"}
          </AlertDescription>
        </Alert>
      </FormErrorMessage>
    )
  }

  if (helperText) {
    return (
      <FormHelperText>
        <Icon as={IconInfoCircle} />
        {helperText}
      </FormHelperText>
    )
  }

  return null
}
