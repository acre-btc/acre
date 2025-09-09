import { describe, expect, it } from "vitest"
import { activitiesUtils } from "#/utils"

describe("Utils functions for activities", () => {
  describe("getEstimatedDuration", () => {
    describe("withdraw", () => {
      describe.each([
        // 0.01 BTC
        { value: 0.01, expectedResult: "72 hours" },
        // 0.1 BTC
        { value: 0.1, expectedResult: "72 hours" },
        // 1 BTC
        { value: 1, expectedResult: "72 hours" },
        // 10 BTC
        { value: 10, expectedResult: "72 hours" },
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
        { value: 0.0001, expectedResult: "2 hours" },
        // 0.001 BTC
        { value: 0.001, expectedResult: "2 hours" },
        // 0.01 BTC
        { value: 0.01, expectedResult: "2 hours" },
        // 0.09 BTC
        { value: 0.09, expectedResult: "2 hours" },
        // 0.1 BTC
        { value: 0.1, expectedResult: "2 hours" },
        // 0.9 BTC
        { value: 0.9, expectedResult: "2 hours" },
        // 1 BTC
        { value: 1, expectedResult: "3 hours" },
        // 10 BTC
        { value: 10, expectedResult: "3 hours" },
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
