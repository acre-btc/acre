import { describe, expect, it } from "vitest"
import { activitiesUtils } from "#/utils"
import { Activity } from "#/types"

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

  describe("isWithdrawToEthereum", () => {
    const baseActivity = {
      id: "1",
      initializedAt: 1760240000,
      amount: 1000n,
      status: "requested",
    } as const

    describe.each([
      {
        name: "a withdrawal paid out in tBTC",
        activity: {
          ...baseActivity,
          type: "withdraw",
          destination: "ethereum",
        },
        expectedResult: true,
      },
      {
        name: "a withdrawal bridged to Bitcoin",
        activity: {
          ...baseActivity,
          type: "withdraw",
          destination: "bitcoin",
        },
        expectedResult: false,
      },
      {
        name: "a deposit",
        activity: { ...baseActivity, type: "deposit" },
        expectedResult: false,
      },
    ] as { name: string; activity: Activity; expectedResult: boolean }[])(
      "when it is $name",
      ({ activity, expectedResult }) => {
        it(`should return ${expectedResult}`, () => {
          expect(activitiesUtils.isWithdrawToEthereum(activity)).toBe(
            expectedResult,
          )
        })
      },
    )
  })
})
