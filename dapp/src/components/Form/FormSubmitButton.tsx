import React from "react"
import { useFormikContext } from "formik"
import { ButtonProps } from "@chakra-ui/react"
import LoadingButton from "../LoadingButton"

export default function FormSubmitButton({ children, ...props }: ButtonProps) {
  const { isSubmitting, isValid } = useFormikContext()

  return (
    <LoadingButton
      type="submit"
      size="lg"
      width="100%"
      isLoading={isSubmitting}
      isDisabled={!isValid}
      {...props}
    >
      {children}
    </LoadingButton>
  )
}
