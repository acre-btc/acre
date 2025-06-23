import React from "react"
import { useFormikContext } from "formik"
import { Button, ButtonProps } from "@chakra-ui/react"
import Spinner from "../Spinner"

export default function FormSubmitButton({ children, ...props }: ButtonProps) {
  const { isSubmitting, isValid } = useFormikContext()

  return (
    <Button
      type="submit"
      size="lg"
      width="100%"
      isLoading={isSubmitting}
      isDisabled={!isValid}
      spinner={<Spinner />}
      {...props}
    >
      {children}
    </Button>
  )
}
