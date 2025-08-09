import React from "react"
import { Button, ButtonProps } from "@chakra-ui/react"
import Spinner from "./Spinner"

export default function LoadingButton({
  isLoading,
  children,
  ...props
}: ButtonProps) {
  return (
    <Button
      isLoading={isLoading}
      spinner={<Spinner variant="unicolor" size="sm" />}
      {...props}
    >
      {children}
    </Button>
  )
}
