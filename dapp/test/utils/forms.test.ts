import { describe, expect, it } from "vitest"
import { forms } from "#/utils"
import { errorMessages } from "#/constants"

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
