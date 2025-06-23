import React from "react"
import { FormikProps } from "formik"
import { Form, FormSubmitButton } from "../Form"
import FormInput from "../Form/FormInput"

const PASSWORD_FIELD_NAME = "password"

export type PasswordFormValues = {
  [PASSWORD_FIELD_NAME]?: string
}

export type PasswordFormBaseProps = {
  formId?: string
  label?: string
  submitButtonText: string
}

export default function PasswordFormBase({
  formId,
  label,
  submitButtonText,
  ...formikProps
}: PasswordFormBaseProps & FormikProps<PasswordFormValues>) {
  return (
    <Form id={formId} onSubmit={formikProps.handleSubmit} w="100%">
      <FormInput name={PASSWORD_FIELD_NAME} label={label} type="password" />
      <FormSubmitButton mt={10}>{submitButtonText}</FormSubmitButton>
    </Form>
  )
}
