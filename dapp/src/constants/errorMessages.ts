import { ACTION_FLOW_TYPES } from "#/types"

const TOKEN_FORM_ERRORS = {
  REQUIRED: "Please enter an amount.",
  EXCEEDED_VALUE:
    "The amount exceeds your current wallet balance. Add more funds to your wallet or lower the deposit amount.",
  INSUFFICIENT_VALUE: (formType: string, minValue: string) =>
    `The amount is below the minimum required ${formType} of ${minValue} BTC.`,
}

const PASSWORD_FORM_ERRORS = {
  REQUIRED: "Please enter a password.",
  INCORRECT_VALUE: "Incorrect password. Please try again.",
  DEFAULT: "Something went wrong...",
}

const WITHDRAWAL_ADDRESS_FORM_ERRORS = {
  REQUIRED: "Please enter an Ethereum address.",
  INVALID: "Invalid Ethereum address.",
  ACCOUNT_ADDRESS:
    "This is your Acre account address. tBTC sent there cannot be moved out.",
}

const ACTION_FORM_ERRORS = {
  [ACTION_FLOW_TYPES.STAKE]: TOKEN_FORM_ERRORS,
  [ACTION_FLOW_TYPES.UNSTAKE]: {
    ...TOKEN_FORM_ERRORS,
    EXCEEDED_VALUE: "Your Acre balance is insufficient.",
  },
}

export default {
  TOKEN_FORM_ERRORS,
  PASSWORD_FORM_ERRORS,
  WITHDRAWAL_ADDRESS_FORM_ERRORS,
  ACTION_FORM_ERRORS,
}
