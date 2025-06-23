import React from "react"
import {
  Spinner as ChakraSpinner,
  SpinnerProps as ChakraSpinnerProps,
} from "@chakra-ui/react"

export default function Spinner({ ...spinnerProps }: ChakraSpinnerProps) {
  return <ChakraSpinner speed="1.3s" {...spinnerProps} />
}
