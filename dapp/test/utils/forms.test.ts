import { describe, expect, it } from "vitest"
import { forms } from "#/utils"
import { errorMessages } from "#/constants"
import { ACTION_FLOW_TYPES } from "#/types"

const ERRORS = errorMessages.WITHDRAWAL_ADDRESS_FORM_ERRORS

// A real, correctly EIP-55 checksummed address.
const CHECKSUMMED = "0x999333A67C9B55E78B97b9C0b287EB4AAeBa3D3b"
const LOWERCASE = CHECKSUMMED.toLowerCase()
// Same address with a single character's case flipped, so the shape is valid
// but the checksum no longer verifies.
const BAD_CHECKSUM = "0x999333a67C9B55E78B97b9C0b287EB4AAeBa3D3b"

describe("validateWithdrawalAddress", () => {
  describe.each([
    { label: "undefined", value: undefined, expected: ERRORS.REQUIRED },
    { label: "an empty string", value: "", expected: ERRORS.REQUIRED },
    { label: "only whitespace", value: "   ", expected: ERRORS.REQUIRED },
    {
      label: "a non-address string",
      value: "not-an-address",
      expected: ERRORS.INVALID,
    },
    {
      label: "a too-short hex string",
      value: "0x123",
      expected: ERRORS.INVALID,
    },
    {
      label: "a hex string with non-hex characters",
      value: `0x${"g".repeat(40)}`,
      expected: ERRORS.INVALID,
    },
    {
      label: "a 42-char string without the 0x prefix",
      value: "x".repeat(42),
      expected: ERRORS.INVALID,
    },
    {
      label: "a valid lowercase address",
      value: LOWERCASE,
      expected: undefined,
    },
    {
      label: "a valid checksummed address",
      value: CHECKSUMMED,
      expected: undefined,
    },
    {
      label: "an all-uppercase address",
      value: `0x${CHECKSUMMED.slice(2).toUpperCase()}`,
      expected: undefined,
    },
    {
      // Casing is not validated here - the SDK rejects a genuinely corrupted
      // mixed-case address when it builds the transaction.
      label: "a checksummed address with one case flipped",
      value: BAD_CHECKSUM,
      expected: undefined,
    },
    {
      label: "a valid address padded with whitespace",
      value: `  ${CHECKSUMMED}  `,
      expected: undefined,
    },
    // Well-formed, so the shape check passes it - but redeeming there burns
    // the position, and nothing downstream rejects it.
    {
      label: "the zero address",
      value: "0x0000000000000000000000000000000000000000",
      expected: ERRORS.INVALID,
    },
  ])("when the value is $label", ({ value, expected }) => {
    it(`should return ${expected ? "an error" : "undefined"}`, () => {
      expect(forms.validateWithdrawalAddress(value)).toBe(expected)
    })
  })

  describe("when a forbidden address is provided", () => {
    it("should reject an exact match", () => {
      expect(
        forms.validateWithdrawalAddress(CHECKSUMMED, {
          forbiddenAddress: CHECKSUMMED,
        }),
      ).toBe(ERRORS.ACCOUNT_ADDRESS)
    })

    it("should reject a match that differs only in case", () => {
      expect(
        forms.validateWithdrawalAddress(LOWERCASE, {
          forbiddenAddress: CHECKSUMMED,
        }),
      ).toBe(ERRORS.ACCOUNT_ADDRESS)
    })

    it("should accept a different address", () => {
      expect(
        forms.validateWithdrawalAddress(CHECKSUMMED, {
          forbiddenAddress: "0x8FF2A98c1F08FD5a4D12bED447b90d4de045C10b",
        }),
      ).toBeUndefined()
    })
  })
})

const UNSTAKE_ERRORS = errorMessages.ACTION_FORM_ERRORS.UNSTAKE
const STAKE_ERRORS = errorMessages.ACTION_FORM_ERRORS.STAKE

// The Bitcoin-path minimum: a stand-in for the tBTC Bridge redemption dust
// threshold. The tBTC-to-EVM path never touches the Bridge and passes 0n.
const BITCOIN_PATH_MINIMUM = 1000000n // 0.01 BTC
const BALANCE = 5000000n // 0.05 BTC

const validateWithdrawal = (value: bigint | undefined, minValue: bigint) =>
  forms.validateTokenAmount(
    ACTION_FLOW_TYPES.UNSTAKE,
    value,
    BALANCE,
    minValue,
    "bitcoin",
  )

describe("validateTokenAmount", () => {
  describe("when withdrawing to Bitcoin - the minimum applies", () => {
    it("should reject an amount below the minimum", () => {
      expect(validateWithdrawal(999999n, BITCOIN_PATH_MINIMUM)).toBe(
        UNSTAKE_ERRORS.INSUFFICIENT_VALUE("withdrawal", "0.01"),
      )
    })

    it("should accept an amount exactly at the minimum", () => {
      expect(
        validateWithdrawal(BITCOIN_PATH_MINIMUM, BITCOIN_PATH_MINIMUM),
      ).toBeUndefined()
    })

    // Ordering guard: the minimum has to be reported before the zero check, so
    // this path keeps the message that names the threshold.
    it("should report zero as below the minimum, not as a missing amount", () => {
      expect(validateWithdrawal(0n, BITCOIN_PATH_MINIMUM)).toBe(
        UNSTAKE_ERRORS.INSUFFICIENT_VALUE("withdrawal", "0.01"),
      )
    })
  })

  describe("when withdrawing to tBTC - the minimum is bypassed with 0n", () => {
    it("should accept a single satoshi", () => {
      expect(validateWithdrawal(1n, 0n)).toBeUndefined()
    })

    it("should accept an amount far below the Bridge dust threshold", () => {
      expect(validateWithdrawal(500n, 0n)).toBeUndefined()
    })

    it("should accept the whole balance", () => {
      expect(validateWithdrawal(BALANCE, 0n)).toBeUndefined()
    })

    // Without this the amount satisfies `0n >= 0n`, and the submit button
    // becomes a silent no-op.
    it("should still reject a zero amount", () => {
      expect(validateWithdrawal(0n, 0n)).toBe(UNSTAKE_ERRORS.REQUIRED)
    })

    it("should still reject an amount above the balance", () => {
      expect(validateWithdrawal(BALANCE + 1n, 0n)).toBe(
        UNSTAKE_ERRORS.EXCEEDED_VALUE,
      )
    })

    it("should still require an amount", () => {
      expect(validateWithdrawal(undefined, 0n)).toBe(UNSTAKE_ERRORS.REQUIRED)
    })
  })

  describe("when the amount breaches both bounds", () => {
    it("should report the maximum first", () => {
      expect(validateWithdrawal(BALANCE + 1n, BALANCE + 100n)).toBe(
        UNSTAKE_ERRORS.EXCEEDED_VALUE,
      )
    })
  })

  describe("when depositing", () => {
    // Regression guard: the zero check must not reach the deposit copy.
    it("should report zero as below the minimum deposit", () => {
      expect(
        forms.validateTokenAmount(
          ACTION_FLOW_TYPES.STAKE,
          0n,
          BALANCE,
          BITCOIN_PATH_MINIMUM,
          "bitcoin",
        ),
      ).toBe(STAKE_ERRORS.INSUFFICIENT_VALUE("deposit", "0.01"))
    })
  })
})
