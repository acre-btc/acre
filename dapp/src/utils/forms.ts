import { isAddress, isAddressEqual, zeroAddress } from "viem"
import { errorMessages } from "#/constants"
import sentry from "#/sentry"
import { ACTION_FLOW_TYPES, ActionFlowType, CurrencyType } from "#/types"
import acreApi from "./acreApi"
import currencyUtils from "./currencyUtils"
import numbersUtils from "./numbersUtils"

function getErrorsObj<T>(errors: { [key in keyof T]: string }) {
  return (Object.keys(errors) as Array<keyof T>).every((name) => !errors[name])
    ? {}
    : errors
}

async function validatePassword(
  value: string | undefined,
): Promise<string | undefined> {
  if (value === undefined || value === "")
    return errorMessages.PASSWORD_FORM_ERRORS.REQUIRED

  try {
    const encodedCode = window.btoa(value)
    const isValid = await acreApi.verifyAccessCode(encodedCode)
    if (!isValid) return errorMessages.PASSWORD_FORM_ERRORS.INCORRECT_VALUE
  } catch (error) {
    sentry.captureException(error)
    console.error(error)
    return errorMessages.PASSWORD_FORM_ERRORS.DEFAULT
  }

  return undefined
}

function validateTokenAmount(
  actionType: ActionFlowType,
  value: bigint | undefined,
  maxValue: bigint,
  minValue: bigint,
  currency: CurrencyType,
): string | undefined {
  const ERRORS_BY_ACTION_TYPE = errorMessages.ACTION_FORM_ERRORS[actionType]

  if (value === undefined) return ERRORS_BY_ACTION_TYPE.REQUIRED

  const { decimals } = currencyUtils.getCurrencyByType(currency)

  const isMaximumValueExceeded = value > maxValue
  const isMinimumValueFulfilled = value >= minValue

  if (isMaximumValueExceeded) return ERRORS_BY_ACTION_TYPE.EXCEEDED_VALUE
  if (!isMinimumValueFulfilled)
    return ERRORS_BY_ACTION_TYPE.INSUFFICIENT_VALUE(
      actionType === ACTION_FLOW_TYPES.STAKE ? "deposit" : "withdrawal",
      numbersUtils.fixedPointNumberToString(minValue, decimals),
    )

  // Only reachable when `minValue` is zero - the tBTC-to-EVM withdrawal, which
  // has no dust threshold to enforce. `0n >= 0n` satisfies the minimum, and the
  // amount would then reach `ActionFormModal`'s `if (!amount) return`, turning
  // the submit button into a silent no-op. Checked last on purpose: wherever a
  // real minimum applies, zero fails it first and keeps the message that names
  // the threshold.
  if (value === 0n) return ERRORS_BY_ACTION_TYPE.REQUIRED

  return undefined
}

/**
 * Validates an Ethereum address a user typed in as a withdrawal destination.
 * @param value The raw input value.
 * @param options.forbiddenAddress An address to reject, in practice the user's
 *        own Acre account (Safe) address - tBTC sent there cannot be moved out.
 */
function validateWithdrawalAddress(
  value: string | undefined,
  options?: { forbiddenAddress?: string },
): string | undefined {
  const address = value?.trim()
  const ERRORS = errorMessages.WITHDRAWAL_ADDRESS_FORM_ERRORS

  if (!address) return ERRORS.REQUIRED

  // Shape only. Casing is not the user's problem - different tools emit
  // lowercase, uppercase and EIP-55 forms of the same valid address, and
  // viem's default `strict: true` would reject the uppercase one. Genuinely
  // corrupted mixed-case addresses are still caught downstream, where the SDK
  // runs them through `EthereumAddress.from`.
  if (!isAddress(address, { strict: false })) return ERRORS.INVALID

  // The zero address is well-formed, so the shape check above passes it, and
  // so does the SDK's address parser. Nothing on chain rejects it either - the
  // shares are burned before the redemption is requested, so the position
  // would be destroyed with no way to recover it.
  if (isAddressEqual(address, zeroAddress)) return ERRORS.INVALID

  // `isAddressEqual` throws on a malformed argument, so the forbidden address
  // is shape-checked first - it comes from the connected wallet and may be
  // absent before the account resolves.
  if (
    options?.forbiddenAddress &&
    isAddress(options.forbiddenAddress, { strict: false }) &&
    isAddressEqual(address, options.forbiddenAddress)
  )
    return ERRORS.ACCOUNT_ADDRESS

  return undefined
}

type ParametrizedError = (value: number) => string

const isFormError = (
  type: keyof typeof errorMessages.TOKEN_FORM_ERRORS,
  message: string,
) => {
  let errorPredicates = [
    errorMessages.ACTION_FORM_ERRORS.STAKE[type],
    errorMessages.ACTION_FORM_ERRORS.UNSTAKE[type],
  ]

  const isParametrizedError = errorPredicates.every(
    (predicate) => typeof predicate === "function",
  )

  if (isParametrizedError) {
    const errorParameter = (message.match(/\d*\.\d+|\d+/g) ?? []).map(
      parseFloat,
    )[0]

    // Already checked that all predicates are functions
    errorPredicates = (errorPredicates as unknown as ParametrizedError[]).map(
      (predicate) => predicate(errorParameter),
    )
  }

  return errorPredicates.includes(message)
}

export default {
  getErrorsObj,
  validatePassword,
  validateTokenAmount,
  validateWithdrawalAddress,
  isFormError,
}
