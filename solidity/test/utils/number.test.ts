import { expect } from "chai"
import { to1e18, to1ePrecision } from "./number"

describe("Number utils", () => {
  describe("to1ePrecision", () => {
    it("should handle integer values", () => {
      expect(to1ePrecision(22, 18)).to.equal(22000000000000000000n)
      expect(to1ePrecision("100", 6)).to.equal(100000000n)
      expect(to1ePrecision(0, 8)).to.equal(0n)
    })

    it("should handle decimal values", () => {
      expect(to1ePrecision(22.5, 18)).to.equal(22500000000000000000n)
      expect(to1ePrecision("100.25", 6)).to.equal(100250000n)
      expect(to1ePrecision(0.1, 8)).to.equal(10000000n)
      expect(to1ePrecision("0.5", 2)).to.equal(50n)
    })

    it("should handle bigint values", () => {
      expect(to1ePrecision(22n, 18)).to.equal(22000000000000000000n)
      expect(to1ePrecision(100n, 6)).to.equal(100000000n)
    })

    it("should truncate excess decimal places", () => {
      expect(to1ePrecision("1.123456789", 6)).to.equal(1123456n)
      expect(to1ePrecision(22.999999999, 2)).to.equal(2299n)
    })

    it("should pad insufficient decimal places", () => {
      expect(to1ePrecision("1.5", 6)).to.equal(1500000n)
      expect(to1ePrecision(22.1, 4)).to.equal(221000n)
    })

    it("should handle empty integer part", () => {
      expect(to1ePrecision(".5", 2)).to.equal(50n)
      expect(to1ePrecision(".123", 6)).to.equal(123000n)
    })

    it("should handle zero values", () => {
      expect(to1ePrecision(0.0, 18)).to.equal(0n)
      expect(to1ePrecision("0.000", 6)).to.equal(0n)
    })

    it("should handle very long decimal strings", () => {
      expect(to1ePrecision("1.123456789012345678901234567890", 18)).to.equal(
        1123456789012345678n,
      )
    })
  })

  describe("to1e18", () => {
    it("should handle integer values", () => {
      expect(to1e18(22)).to.equal(22000000000000000000n)
      expect(to1e18("100")).to.equal(100000000000000000000n)
      expect(to1e18(0)).to.equal(0n)
    })

    it("should handle decimal values", () => {
      expect(to1e18(22.5)).to.equal(22500000000000000000n)
      expect(to1e18("100.25")).to.equal(100250000000000000000n)
      expect(to1e18(0.1)).to.equal(100000000000000000n)
      expect(to1e18("0.5")).to.equal(500000000000000000n)
    })

    it("should handle bigint values", () => {
      expect(to1e18(22n)).to.equal(22000000000000000000n)
      expect(to1e18(100n)).to.equal(100000000000000000000n)
    })

    it("should truncate excess decimal places beyond 18", () => {
      expect(to1e18("1.123456789012345678901234")).to.equal(
        1123456789012345678n,
      )
    })

    it("should handle empty integer part", () => {
      expect(to1e18(".5")).to.equal(500000000000000000n)
      expect(to1e18(".123")).to.equal(123000000000000000n)
    })
  })
})
