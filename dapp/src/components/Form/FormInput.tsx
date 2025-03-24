import React from "react"
import { FormControl, FormLabel, Input, InputProps } from "@chakra-ui/react"
import { useFormField } from "#/hooks"
import HelperErrorText from "./HelperErrorText"

export type FormInputProps = {
  name: string
  label?: string
  helperText?: string | JSX.Element
} & Omit<InputProps, "id" | "isInvalid" | "value" | "onChange">

export default function FormInput({
  name,
  label,
  helperText,
  ...inputProps
}: FormInputProps) {
  const { field, value, errorMsgText, hasError, onChange } =
    useFormField<string>(name)

  return (
    <FormControl isInvalid={hasError} isDisabled={inputProps.isDisabled}>
      {label && <FormLabel htmlFor={name}>{label}</FormLabel>}
      <Input
        {...inputProps}
        {...field}
        id={name}
        isInvalid={hasError}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <HelperErrorText
        helperText={helperText}
        errorMsgText={errorMsgText}
        hasError={hasError}
      />
    </FormControl>
  )
}
