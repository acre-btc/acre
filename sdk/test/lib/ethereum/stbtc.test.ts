import ethers, { Contract } from "ethers"
import stBTC from "@acre-btc/contracts/deployments/sepolia/stBTC.json"
import { EthereumStBTC } from "./acrebtc"
import { Hex } from "../../../src/lib/utils"
import {
  EthereumAddress,
  EthereumContractRunner,
} from "../../../src/lib/ethereum"

jest.mock("ethers", (): object => ({
  Contract: jest.fn(),
  ...jest.requireActual("ethers"),
}))

jest.mock("@acre-btc/contracts/deployments/sepolia/stBTC.json", () => ({
  address: "0xCA5cd11F30DD8437628ce4D0c8cE6cf7109b0FC2",
  abi: [],
}))

describe("stbtc", () => {
  let stbtc: EthereumStBTC
  const staker = EthereumAddress.from(ethers.Wallet.createRandom().address)

  const mockedContractInstance = {
    totalAssets: jest.fn(),
    balanceOf: jest.fn(),
    assetsBalanceOf: jest.fn(),
    entryFeeBasisPoints: jest.fn(),
    exitFeeBasisPoints: jest.fn(),
    interface: {
      encodeFunctionData: jest.fn(),
    },
    previewRedeem: jest.fn(),
    convertToShares: jest.fn(),
  }

  beforeAll(() => {
    jest
      .spyOn(ethers, "Contract")
      .mockImplementationOnce(
        () => mockedContractInstance as unknown as Contract,
      )

    stbtc = new EthereumStBTC(
      {
        runner: {} as EthereumContractRunner,
      },
      "sepolia",
    )
  })

  describe("totalAssets", () => {
    const expectedResult = 48218274102123n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.totalAssets.mockResolvedValue(expectedResult)
      result = await stbtc.totalAssets()
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.totalAssets).toHaveBeenCalled()
    })

    it("should return total tBTC amount under stBTC contract management", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("balanceOf", () => {
    const expectedResult = 4294967295n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.balanceOf.mockResolvedValue(expectedResult)
      result = await stbtc.balanceOf(staker)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.balanceOf).toHaveBeenCalledWith(
        `0x${staker.identifierHex}`,
      )
    })

    it("should return balance of stBTC tokens", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("assetsBalanceOf", () => {
    const expectedResult = 4294967295n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.assetsBalanceOf.mockResolvedValue(expectedResult)
      result = await stbtc.assetsBalanceOf(staker)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.assetsBalanceOf).toHaveBeenCalledWith(
        `0x${staker.identifierHex}`,
      )
    })

    it("should return value of assets that would be exchanged for the amount of shares owned by the staker ", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("calculateDepositFee", () => {
    // 0.1 in 1e18 precision
    const amount = 100000000000000000n
    const mockedEntryFeeBasisPointsValue = 1n
    // (amount * basisPoints) / (basisPoints + 1e4)
    const expectedResult = 9999000099991n

    let result: bigint

    describe("when the entry fee basis points value is not yet cached", () => {
      beforeAll(async () => {
        mockedContractInstance.entryFeeBasisPoints.mockResolvedValue(
          mockedEntryFeeBasisPointsValue,
        )

        result = await stbtc.calculateDepositFee(amount)
      })

      it("should get the entry fee basis points from contract", () => {
        expect(mockedContractInstance.entryFeeBasisPoints).toHaveBeenCalled()
      })

      it("should calculate the deposit fee correctly", () => {
        expect(result).toEqual(expectedResult)
      })
    })

    describe("when the entry fee basis points value is cached", () => {
      beforeAll(async () => {
        mockedContractInstance.entryFeeBasisPoints.mockResolvedValue(
          mockedEntryFeeBasisPointsValue,
        )

        await stbtc.calculateDepositFee(amount)

        result = await stbtc.calculateDepositFee(amount)
      })

      it("should get the entry fee basis points from cache", () => {
        expect(
          mockedContractInstance.entryFeeBasisPoints,
        ).toHaveBeenCalledTimes(1)
      })

      it("should calculate the deposit fee correctly", () => {
        expect(result).toEqual(expectedResult)
      })
    })
  })

  describe("calculateWithdrawalFee", () => {
    // 0.1 in 1e18 precision
    const amount = 100000000000000000n
    const mockedExitFeeBasisPointsValue = 25n
    // (amount * basisPoints) / (basisPoints + 1e4)
    const expectedResult = 249376558603492n

    let result: bigint

    describe("when the exit fee basis points value is not yet cached", () => {
      beforeAll(async () => {
        mockedContractInstance.exitFeeBasisPoints.mockResolvedValue(
          mockedExitFeeBasisPointsValue,
        )

        result = await stbtc.calculateWithdrawalFee(amount)
      })

      it("should get the exit fee basis points from contract", () => {
        expect(mockedContractInstance.exitFeeBasisPoints).toHaveBeenCalled()
      })

      it("should calculate the withdrawal fee correctly", () => {
        expect(result).toEqual(expectedResult)
      })
    })

    describe("when the exit fee basis points value is cached", () => {
      beforeAll(async () => {
        mockedContractInstance.exitFeeBasisPoints.mockResolvedValue(
          mockedExitFeeBasisPointsValue,
        )

        await stbtc.calculateWithdrawalFee(amount)

        result = await stbtc.calculateWithdrawalFee(amount)
      })

      it("should get the exit fee basis points from cache", () => {
        expect(mockedContractInstance.exitFeeBasisPoints).toHaveBeenCalledTimes(
          1,
        )
      })

      it("should calculate the deposit fee correctly", () => {
        expect(result).toEqual(expectedResult)
      })
    })
  })

  describe("getChainIdentifier", () => {
    it("should return contract address", () => {
      const result = stbtc.getChainIdentifier()

      expect(result.equals(EthereumAddress.from(stBTC.address))).toBeTruthy()
    })
  })

  describe("encodeApproveAndCallFunctionData", () => {
    const mockedEncodedData = "0x1234"
    const spender = EthereumAddress.from(ethers.Wallet.createRandom().address)
    const amount = 1000n
    const extraData = Hex.from("0x5678")

    let result: Hex

    beforeAll(() => {
      mockedContractInstance.interface.encodeFunctionData.mockReturnValueOnce(
        mockedEncodedData,
      )

      result = stbtc.encodeApproveAndCallFunctionData(
        spender,
        amount,
        extraData,
      )
    })

    it("should encode function data", () => {
      expect(
        mockedContractInstance.interface.encodeFunctionData,
      ).toHaveBeenCalledWith("approveAndCall", [
        `0x${spender.identifierHex}`,
        amount,
        extraData.toPrefixedString(),
      ])
    })

    it("should return encoded data as hex", () => {
      expect(result).toBeInstanceOf(Hex)
      expect(result.toPrefixedString()).toBe(mockedEncodedData)
    })
  })

  describe("previewRedeem", () => {
    const expectedResult = 1000n
    const shares = 10n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.previewRedeem.mockResolvedValue(expectedResult)

      result = await stbtc.previewRedeem(shares)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.previewRedeem).toHaveBeenCalledWith(shares)
    })

    it("should return the amount of tBTC that will be redeemed for the given amount of stBTC shares.", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("convertToShares", () => {
    const expectedResult = 2000n
    const tbtcAmount = 10n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.convertToShares.mockResolvedValue(expectedResult)

      result = await stbtc.convertToShares(tbtcAmount)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.convertToShares).toHaveBeenCalledWith(
        tbtcAmount,
      )
    })

    it("should convert tBTC amount to stBTC shares", () => {
      expect(result).toEqual(expectedResult)
    })
  })
})
