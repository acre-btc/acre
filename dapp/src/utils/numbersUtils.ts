function roundUp(amount: number, desiredDecimals = 2): number {
  return Math.ceil(amount * 10 ** desiredDecimals) / 10 ** desiredDecimals
}

const numberToLocaleString = (
  value: string | number,
  desiredDecimals = 0,
): string => {
  const number = typeof value === "number" ? value : parseFloat(value)

  if (number === 0 && desiredDecimals === 0) return "0"

  if (number === 0) return `0.${"0".repeat(desiredDecimals)}`

  return number.toLocaleString("default", {
    minimumFractionDigits: desiredDecimals,
    maximumFractionDigits: desiredDecimals,
  })
}

/**
 * Convert a fixed point bigint with precision `fixedPointDecimals` to a
 * floating point number truncated to `desiredDecimals`.
 *
 * This function is based on the solution used by the Taho extension.
 * Source:
 * https://github.com/tahowallet/extension/blob/main/background/lib/fixed-point.ts#L216-L239
 */
function bigIntToUserAmount(
  fixedPoint: bigint,
  fixedPointDecimals: number,
  desiredDecimals = 2,
): number {
  const fixedPointDesiredDecimalsAmount =
    fixedPoint /
    10n ** BigInt(Math.max(1, fixedPointDecimals - desiredDecimals))

  const formattedAmount =
    Number(fixedPointDesiredDecimalsAmount) /
    10 ** Math.min(desiredDecimals, fixedPointDecimals)

  return formattedAmount
}

/**
 * Display a token amount correctly with desired decimals.
 * The function returns a string with a language-sensitive representation of this number.
 *
 * - If the amount entered is zero, return the result with the desired decimals.
 *   For example, 0.00 for a precision of 2.
 * - If `formattedAmount` is less than the minimum amount to display
 *  for the specified precision return information about this.
 *  For example, <0.01 for a precision of 2.
 *  - Other amounts are formatted according to the use of the `bigIntToUserAmount` function.
 *
 */
const formatTokenAmount = (
  amount: number | string | bigint,
  decimals = 18,
  desiredDecimals = 2,
  withRoundUp = false,
) => {
  const fixedPoint = BigInt(amount)

  if (fixedPoint === 0n) {
    return `0.${"0".repeat(desiredDecimals)}`
  }

  const formattedAmount = bigIntToUserAmount(
    fixedPoint,
    decimals,
    // To round the amount up, let's increase the precision by one.
    // The desired decimal numbers will be set later anyway.
    withRoundUp ? desiredDecimals + 1 : desiredDecimals,
  )

  const minAmountToDisplay = 1 / 10 ** Math.min(desiredDecimals, decimals)

  if (minAmountToDisplay > formattedAmount) {
    return `<0.${"0".repeat(desiredDecimals - 1)}1`
  }

  const finalFormattedAmount = withRoundUp
    ? roundUp(formattedAmount, desiredDecimals)
    : formattedAmount
  return numberToLocaleString(finalFormattedAmount, desiredDecimals)
}

const formatSatoshiAmount = (
  amount: number | string | bigint,
  desiredDecimals = 2,
) => formatTokenAmount(amount, 8, desiredDecimals)

/**
 * Converts a fixed point number with a bigint amount and a decimals field
 * indicating the orders of magnitude in `amount` behind the decimal point into
 * a string in US decimal format (no thousands separators, . for the decimal
 * separator).
 *
 * Used in cases where precision is critical.
 *
 * This function is based on the solution used by the Taho extension.
 * Source:
 * https://github.com/tahowallet/extension/blob/main/background/lib/fixed-point.ts#L172-L214
 */
function fixedPointNumberToString(
  amount: bigint,
  decimals: number,
  trimTrailingZeros = true,
): string {
  const undecimaledAmount = amount.toString()
  const preDecimalLength = undecimaledAmount.length - decimals

  const preDecimalCharacters =
    preDecimalLength > 0
      ? undecimaledAmount.substring(0, preDecimalLength)
      : "0"
  const postDecimalCharacters =
    "0".repeat(Math.max(-preDecimalLength, 0)) +
    undecimaledAmount.substring(preDecimalLength)

  const trimmedPostDecimalCharacters = trimTrailingZeros
    ? postDecimalCharacters.replace(/0*$/, "")
    : postDecimalCharacters

  const decimalString =
    trimmedPostDecimalCharacters.length > 0
      ? `.${trimmedPostDecimalCharacters}`
      : ""

  return `${preDecimalCharacters}${decimalString}`
}

/**
 * Convert a fixed point bigint with precision `fixedPointDecimals` to another
 * fixed point bigint with precision `targetDecimals`.
 *
 * It is highly recommended that the precision of the fixed point bigint is
 * tracked alongside the number, e.g. as with the FixedPointNumber type. To this
 * end, prefer `convertFixedPointNumber` unless you are already carrying
 * precision information separately.
 *
 * Source:
 * https://github.com/tahowallet/extension/blob/main/background/lib/fixed-point.ts#L25-L44
 */
function convertFixedPoint(
  fixedPoint: bigint,
  fixedPointDecimals: number,
  targetDecimals: number,
): bigint {
  if (fixedPointDecimals >= targetDecimals) {
    return fixedPoint / 10n ** BigInt(fixedPointDecimals - targetDecimals)
  }

  return fixedPoint * 10n ** BigInt(targetDecimals - fixedPointDecimals)
}

/**
 * Parses a simple floating point string in US decimal format (potentially
 * using commas as thousands separators, and using a single period as a decimal
 * separator) to a FixedPointNumber. The decimals in the returned
 * FixedPointNumber will match the number of digits after the decimal in the
 * floating point string.
 *
 * Source:
 * https://github.com/tahowallet/extension/blob/main/background/lib/fixed-point.ts#L134-L170
 */
function parseToFixedPointNumber(
  floatingPointString: string,
): { amount: bigint; decimals: number } | undefined {
  if (!floatingPointString.match(/^[^0-9]*([0-9,]+)(?:\.([0-9]*))?$/)) {
    return undefined
  }

  const [whole, decimals, ...extra] = floatingPointString.split(".")

  // Only one `.` supported.
  if (extra.length > 0) {
    return undefined
  }

  const noThousandsSeparatorWhole = whole.replace(",", "")
  const setDecimals = decimals ?? ""

  try {
    return {
      amount: BigInt([noThousandsSeparatorWhole, setDecimals].join("")),
      decimals: setDecimals.length,
    }
  } catch (error) {
    return undefined
  }
}

/**
 * Convert a floating point number to bigint.`.
 * It is necessary to parse floating point number to fixed point first.
 * Then convert a fixed point bigint with precision `parsedAmount.decimals` to another
 * fixed point bigint with precision `decimals`.
 */
function userAmountToBigInt(amount: string, decimals = 18): bigint | undefined {
  const parsedAmount = parseToFixedPointNumber(amount)

  if (typeof parsedAmount === "undefined") {
    return undefined
  }

  return convertFixedPoint(parsedAmount.amount, parsedAmount.decimals, decimals)
}

// Generates a random integer in min-max range (inclusively)
const randomInteger = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const addLeadingZero = (num: number): string =>
  num >= 0 && num <= 9 ? `0${num}` : `${num}`

const getPercentValue = (value: number, maxValue: number) =>
  (value * 100) / maxValue

type BigIntDecimals = BigIntToLocaleStringOptions["maximumFractionDigits"]

type FormatNumberToCompactStringOptions<V> = {
  decimals?: V extends bigint ? BigIntDecimals : number
  withAutoCompactFormat?: boolean
  currency?: "USD"
}

/**
 * Formats a number or bigint into compact string with K, M, B, or T suffix.
 * @param value The number or bigint to format.
 * @param options Formatting options.
 * @param options.currency If provided, formats the number as currency
 * (e.g., USD).
 * @param options.withAutoCompactFormat If true, decimal places varies based on
 * the size of the number (2 for thousands, 1 for millions or more).
 * @param options.decimals If provided, sets the number of decimal places to
 * a constant value. Defaults to 2 for currency and 4 otherwise.
 * @returns The formatted number as a string.
 */
export function formatNumberToCompactString<V extends number | bigint>(
  value: V,
  options: FormatNumberToCompactStringOptions<V> = {},
): string {
  const {
    currency,
    decimals = currency ? 2 : 4,
    withAutoCompactFormat = false,
  } = options

  const isBigInt = typeof value === "bigint"

  const isThousands = isBigInt ? value >= 1000n : value >= 1000
  const isMillionsOrMore = isBigInt ? value >= 1_000_000n : value >= 1_000_000

  let maximumFractionDigits = decimals as BigIntDecimals
  if (withAutoCompactFormat && isThousands) maximumFractionDigits = 2
  if (withAutoCompactFormat && isMillionsOrMore) maximumFractionDigits = 1

  return value.toLocaleString("en-US", {
    notation: "compact",
    compactDisplay: "short",
    style: currency ? "currency" : undefined,
    currency,
    maximumFractionDigits,
  })
}

export default {
  roundUp,
  numberToLocaleString,
  bigIntToUserAmount,
  formatTokenAmount,
  formatSatoshiAmount,
  fixedPointNumberToString,
  userAmountToBigInt,
  randomInteger,
  addLeadingZero,
  getPercentValue,
  formatNumberToCompactString,
}
