export function to1ePrecision(
  n: string | number | bigint,
  precision: number,
): bigint {
  if (typeof n === "bigint") {
    return n * 10n ** BigInt(precision)
  }

  const str = n.toString()
  const decimalIndex = str.indexOf(".")

  if (decimalIndex === -1) {
    return BigInt(n) * 10n ** BigInt(precision)
  }

  const integerPart = str.slice(0, decimalIndex)
  const decimalPart = str.slice(decimalIndex + 1)

  // Pad or truncate decimal part to specified precision
  const paddedDecimalPart = decimalPart
    .padEnd(precision, "0")
    .slice(0, precision)

  const integerValue = BigInt(integerPart || "0")
  const decimalValue = BigInt(paddedDecimalPart)

  return integerValue * 10n ** BigInt(precision) + decimalValue
}

export function to1e18(n: string | number | bigint): bigint {
  return to1ePrecision(n, 18)
}
