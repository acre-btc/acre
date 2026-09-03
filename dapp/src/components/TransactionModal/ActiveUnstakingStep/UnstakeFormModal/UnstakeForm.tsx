import { FormikErrors, withFormik } from "formik"
import { forms } from "#/utils"
import { ACTION_FLOW_TYPES, BaseFormProps } from "#/types"
import UnstakeFormBase, {
  UnstakeFormBaseProps,
  UnstakeFormValues,
  withdrawsToTbtc,
} from "./UnstakeFormBase"

type UnstakeFormProps = {
  accountEvmAddress?: string
} & UnstakeFormBaseProps &
  BaseFormProps<UnstakeFormValues>

const UnstakeForm = withFormik<UnstakeFormProps, UnstakeFormValues>({
  mapPropsToValues: ({ tokenBalance }) => ({
    // A withdrawal exits the whole position.
    amount: tokenBalance,
    // BTC remains the default destination for a position that can use it.
    withdrawToTbtc: false,
    destinationAddress: "",
  }),
  validate: (
    { amount, withdrawToTbtc, destinationAddress },
    { tokenBalance, currency, minTokenAmount, accountEvmAddress },
  ) => {
    const errors: FormikErrors<UnstakeFormValues> = {}
    // The Formik field records the choice the user made; whether the position
    // is dust is re-derived from props, so a balance that arrives late cannot
    // strand a stale value - `withFormik` never re-runs `mapPropsToValues`.
    const toTbtc = withdrawsToTbtc(tokenBalance, minTokenAmount, withdrawToTbtc)

    errors.amount = forms.validateTokenAmount(
      ACTION_FLOW_TYPES.UNSTAKE,
      amount,
      tokenBalance,
      // The minimum exists because of the tBTC Bridge dust threshold, which the
      // tBTC-to-EVM path never touches. Keeping it would deny sub-dust holders
      // their only exit.
      toTbtc ? 0n : minTokenAmount,
      currency,
    )

    if (toTbtc) {
      errors.destinationAddress = forms.validateWithdrawalAddress(
        destinationAddress,
        { forbiddenAddress: accountEvmAddress },
      )
    }

    return forms.getErrorsObj(errors)
  },
  handleSubmit: (values, { props }) => {
    // Resolve the destination here so it is decided in one place and everything
    // downstream keeps reading a plain boolean.
    props.onSubmitForm({
      ...values,
      withdrawToTbtc: withdrawsToTbtc(
        props.tokenBalance,
        props.minTokenAmount,
        values.withdrawToTbtc,
      ),
    })
  },
  validateOnBlur: false,
  validateOnChange: false,
})(UnstakeFormBase)

export default UnstakeForm
