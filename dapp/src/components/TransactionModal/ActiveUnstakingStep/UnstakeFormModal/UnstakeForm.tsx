import { FormikErrors, withFormik } from "formik"
import { forms } from "#/utils"
import { ACTION_FLOW_TYPES, BaseFormProps } from "#/types"
import UnstakeFormBase, {
  UnstakeFormBaseProps,
  UnstakeFormValues,
} from "./UnstakeFormBase"

type UnstakeFormProps = {
  minTokenAmount: bigint
  accountEvmAddress?: string
} & UnstakeFormBaseProps &
  BaseFormProps<UnstakeFormValues>

const UnstakeForm = withFormik<UnstakeFormProps, UnstakeFormValues>({
  mapPropsToValues: () => ({
    amount: undefined,
    // BTC remains the default destination.
    withdrawToTbtc: false,
    destinationAddress: "",
  }),
  validate: (
    { amount, withdrawToTbtc, destinationAddress },
    { tokenBalance, currency, minTokenAmount, accountEvmAddress },
  ) => {
    const errors: FormikErrors<UnstakeFormValues> = {}

    errors.amount = forms.validateTokenAmount(
      ACTION_FLOW_TYPES.UNSTAKE,
      amount,
      tokenBalance,
      // The minimum exists because of the tBTC Bridge dust threshold, which the
      // tBTC-to-EVM path never touches. Keeping it would deny sub-dust holders
      // their only exit.
      withdrawToTbtc ? 0n : minTokenAmount,
      currency,
    )

    if (withdrawToTbtc) {
      errors.destinationAddress = forms.validateWithdrawalAddress(
        destinationAddress,
        { forbiddenAddress: accountEvmAddress },
      )
    }

    return forms.getErrorsObj(errors)
  },
  handleSubmit: (values, { props }) => {
    props.onSubmitForm(values)
  },
  validateOnBlur: false,
  validateOnChange: false,
})(UnstakeFormBase)

export default UnstakeForm
