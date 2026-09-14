import { describe, expect, it } from "vitest"
import { activitiesUtils } from "#/utils"

describe("Utils functions for activities", () => {
  // Copy quoting a withdrawal time reads the number from here, so it is stated
  // identically wherever it appears.
  describe("getWithdrawalDuration", () => {
    it("should return the tBTC redemption time", () => {
      expect(activitiesUtils.getWithdrawalDuration()).toEqual("6 hours")
    })
  })

  describe("getWithdrawalMaxDuration", () => {
    it("should return the ceiling quoted alongside the estimate", () => {
      expect(activitiesUtils.getWithdrawalMaxDuration()).toEqual("24 hours")
    })
  })

  describe("getWithdrawalDurationInSeconds", () => {
    it("should match the estimate a countdown is rendered beside", () => {
      expect(activitiesUtils.getWithdrawalDurationInSeconds()).toEqual(
        6 * 60 * 60,
      )
    })
  })

  describe("getEstimatedDuration", () => {
    describe("withdraw", () => {
      // `acreBTC.redeem` pays out in the very transaction that requests it, so
      // there is no duration to estimate.
      it("should not quote a duration for a tBTC withdrawal", () => {
        expect(
          activitiesUtils.getEstimatedDuration(BigInt(1e8), "withdraw", "tbtc"),
        ).toEqual("Immediate")
      })

      it("should quote the same number as `getWithdrawalDuration`", () => {
        expect(
          activitiesUtils.getEstimatedDuration(BigInt(1e8), "withdraw"),
        ).toContain(activitiesUtils.getWithdrawalDuration())
      })

      // Bridged to Bitcoin, and the tBTC redemption process does not depend
      // on the amount.
      describe.each([
        // 0.01 BTC
        { value: 0.01, expectedResult: "~6 hours" },
        // 0.1 BTC
        { value: 0.1, expectedResult: "~6 hours" },
        // 1 BTC
        { value: 1, expectedResult: "~6 hours" },
        // 10 BTC
        { value: 10, expectedResult: "~6 hours" },
      ])("when it is $value BTC", ({ value, expectedResult }) => {
        it(`should return ${expectedResult}`, () => {
          expect(
            activitiesUtils.getEstimatedDuration(
              BigInt(value * 1e8),
              "withdraw",
            ),
          ).toEqual(expectedResult)
        })
      })
    })

    describe("deposit", () => {
      describe.each([
        // 0.0001 BTC
        { value: 0.0001, expectedResult: "~2 hours" },
        // 0.001 BTC
        { value: 0.001, expectedResult: "~2 hours" },
        // 0.01 BTC
        { value: 0.01, expectedResult: "~2 hours" },
        // 0.09 BTC
        { value: 0.09, expectedResult: "~2 hours" },
        // 0.1 BTC
        { value: 0.1, expectedResult: "~2 hours" },
        // 0.9 BTC
        { value: 0.9, expectedResult: "~2 hours" },
        // 1 BTC
        { value: 1, expectedResult: "~3 hours" },
        // 10 BTC
        { value: 10, expectedResult: "~3 hours" },
      ])("when it is $value BTC", ({ value, expectedResult }) => {
        it(`should return ${expectedResult}`, () => {
          expect(
            activitiesUtils.getEstimatedDuration(
              BigInt(value * 1e8),
              "deposit",
            ),
          ).toEqual(expectedResult)
        })
      })
    })
  })
})
