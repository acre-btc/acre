import React from "react"
import { Button, ButtonProps, Spinner } from "@chakra-ui/react"

export default function LoadingButton({
  isLoading,
  children,
  ...props
}: ButtonProps) {
  return (
    <Button
      isLoading={isLoading}
      spinner={<Spinner variant="filled" />}
      {...props}
    >
      {children}
    </Button>
  )
}
