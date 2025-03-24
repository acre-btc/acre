import { FormikErrors, withFormik } from "formik"
import { BaseFormProps } from "#/types"
import { forms } from "#/utils"
import PasswordFormBase, {
  PasswordFormBaseProps,
  PasswordFormValues,
} from "./PasswordFormBase"

type PasswordFormProps = PasswordFormBaseProps &
  BaseFormProps<PasswordFormValues>

const PasswordForm = withFormik<PasswordFormProps, PasswordFormValues>({
  mapPropsToValues: () => ({
    password: "",
  }),
  validate: async ({ password }) => {
    const errors: FormikErrors<PasswordFormValues> = {}

    errors.password = await forms.validatePassword(password)

    return forms.getErrorsObj(errors)
  },
  handleSubmit: (values, { props }) => {
    props.onSubmitForm(values)
  },
  validateOnBlur: false,
  validateOnChange: false,
})(PasswordFormBase)

export default PasswordForm
