import React from "react"
import { Checkbox, CheckboxProps, FormControl } from "@chakra-ui/react"
import { useFormField } from "#/hooks"
import HelperErrorText from "./HelperErrorText"

export type FormCheckboxProps = {
  name: string
  label: string | JSX.Element
  helperText?: string | JSX.Element
  onValueChange?: (checked: boolean) => void
} & Omit<CheckboxProps, "id" | "isInvalid" | "isChecked" | "onChange">

export default function FormCheckbox({
  name,
  label,
  helperText,
  onValueChange,
  ...checkboxProps
}: FormCheckboxProps) {
  const { field, value, errorMsgText, hasError, onChange } =
    useFormField<boolean>(name)

  // Formik's `field.value` is a boolean here, which collides with Chakra's
  // `value` prop (string | number). Drop it and drive the control from
  // `isChecked` instead.
  const { value: _, ...fieldProps } = field

  return (
    <FormControl isInvalid={hasError} isDisabled={checkboxProps.isDisabled}>
      <Checkbox
        {...checkboxProps}
        {...fieldProps}
        id={name}
        isChecked={Boolean(value)}
        isInvalid={hasError}
        onChange={(event) => {
          onChange(event.target.checked)
          onValueChange?.(event.target.checked)
        }}
      >
        {label}
      </Checkbox>
      <HelperErrorText
        helperText={helperText}
        errorMsgText={errorMsgText}
        hasError={hasError}
      />
    </FormControl>
  )
}
