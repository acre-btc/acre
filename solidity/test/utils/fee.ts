// Calculates the fee when it's included in the amount.
// One is added to the result if there is a remainder to match the Solidity
// mulDiv() math which rounds up towards infinity (Ceil) when fees are
// calculated.
export function feeOnTotal(
  amount: bigint,
  feeBasisPoints: bigint,
  basisPointScale = 10000n,
) {
  const result = (amount * feeBasisPoints) / (feeBasisPoints + basisPointScale)
  if ((amount * feeBasisPoints) % (feeBasisPoints + basisPointScale) > 0) {
    return result + 1n
  }
  return result
}

// Calculates the fee when it's not included in the amount.
// One is added to the result if there is a remainder to match the Solidity
// mulDiv() math which rounds up towards infinity (Ceil) when fees are
// calculated.
export function feeOnRaw(
  amount: bigint,
  feeBasisPoints: bigint,
  basisPointScale = 10000n,
) {
  const result = (amount * feeBasisPoints) / basisPointScale
  if ((amount * feeBasisPoints) % basisPointScale > 0) {
    return result + 1n
  }
  return result
}
