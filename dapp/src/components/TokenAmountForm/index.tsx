import { FormikErrors, withFormik } from "formik"
import { forms } from "#/utils"
import { ActionFlowType, BaseFormProps } from "#/types"
import TokenAmountFormBase, {
  TokenAmountFormBaseProps,
  TokenAmountFormValues,
} from "./TokenAmountFormBase"

type TokenAmountFormProps = {
  actionType: ActionFlowType
  minTokenAmount: bigint
} & TokenAmountFormBaseProps &
  BaseFormProps<TokenAmountFormValues>

const TokenAmountForm = withFormik<TokenAmountFormProps, TokenAmountFormValues>(
  {
    mapPropsToValues: () => ({
      amount: undefined,
    }),
    validate: (
      { amount },
      { tokenBalance, currency, minTokenAmount, actionType },
    ) => {
      const errors: FormikErrors<TokenAmountFormValues> = {}

      errors.amount = forms.validateTokenAmount(
        actionType,
        amount,
        tokenBalance,
        minTokenAmount,
        currency,
      )

      return forms.getErrorsObj(errors)
    },
    handleSubmit: (values, { props }) => {
      props.onSubmitForm(values)
    },
    validateOnBlur: false,
    validateOnChange: false,
  },
)(TokenAmountFormBase)

export default TokenAmountForm
