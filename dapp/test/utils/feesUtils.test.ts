import { describe, expect, it } from "vitest"
import { feesUtils } from "#/utils"
import { Fees } from "#/types"

describe("Utils functions for fees", () => {
  describe("forWithdrawalDestination", () => {
    // As returned by `protocol.estimateWithdrawalFee`, which always quotes the
    // Bitcoin path.
    const bitcoinPathFees: Fees = {
      tbtc: { fee: 1000n, isReimbursable: false },
      acre: { fee: 200n, isReimbursable: false },
      total: 1200n,
    }

    describe("when the destination is bitcoin", () => {
      it("should keep the quote untouched", () => {
        expect(
          feesUtils.forWithdrawalDestination(bitcoinPathFees, "bitcoin"),
        ).toEqual(bitcoinPathFees)
      })
    })

    describe("when the destination is tbtc", () => {
      const result = feesUtils.forWithdrawalDestination(bitcoinPathFees, "tbtc")

      it("should drop the tBTC Bridge fee - this path never touches the Bridge", () => {
        expect(result.tbtc.fee).toEqual(0n)
      })

      it("should keep the acre exit fee", () => {
        expect(result.acre).toEqual(bitcoinPathFees.acre)
      })

      it("should total only the acre fee", () => {
        expect(result.total).toEqual(bitcoinPathFees.acre.fee)
      })
    })
  })
})
