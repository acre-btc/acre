import ethers, { Contract, TransactionReceipt } from "ethers"
import acreBTCContract from "@acre-btc/contracts/deployments/sepolia/acreBTC.json"
import { EthereumAcreBTC } from "../../../src/lib/ethereum/acrebtc"
import { Hex } from "../../../src/lib/utils"
import {
  EthereumAddress,
  EthereumContractRunner,
} from "../../../src/lib/ethereum"

jest.mock("ethers", (): object => ({
  Contract: jest.fn(),
  ...jest.requireActual("ethers"),
}))

jest.mock("@acre-btc/contracts/deployments/sepolia/acreBTC.json", () => ({
  address: "0xCA5cd11F30DD8437628ce4D0c8cE6cf7109b0FC2",
  abi: [],
}))

describe("AcreBTC", () => {
  let acreBTC: EthereumAcreBTC
  const staker = EthereumAddress.from(ethers.Wallet.createRandom().address)

  const mockedContractInstance = {
    totalAssets: jest.fn(),
    balanceOf: jest.fn(),
    assetsBalanceOf: jest.fn(),
    entryFeeBasisPoints: jest.fn(),
    exitFeeBasisPoints: jest.fn(),
    interface: {
      encodeFunctionData: jest.fn(),
      getEvent: jest.fn(),
      parseLog: jest.fn(),
    },
    previewRedeem: jest.fn(),
    convertToShares: jest.fn(),
  }

  const mockedRunner: EthereumContractRunner = {
    provider: {
      getTransactionReceipt: jest.fn(),
    } as unknown as EthereumContractRunner["provider"],
  }

  beforeAll(() => {
    jest
      .spyOn(ethers, "Contract")
      .mockImplementationOnce(
        () => mockedContractInstance as unknown as Contract,
      )

    acreBTC = new EthereumAcreBTC(
      {
        runner: mockedRunner,
      },
      "sepolia",
    )
  })

  describe("totalAssets", () => {
    const expectedResult = 48218274102123n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.totalAssets.mockResolvedValue(expectedResult)
      result = await acreBTC.totalAssets()
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.totalAssets).toHaveBeenCalled()
    })

    it("should return total tBTC amount under acreBTC contract management", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("balanceOf", () => {
    const expectedResult = 4294967295n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.balanceOf.mockResolvedValue(expectedResult)
      result = await acreBTC.balanceOf(staker)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.balanceOf).toHaveBeenCalledWith(
        `0x${staker.identifierHex}`,
      )
    })

    it("should return balance of acreBTC tokens", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("assetsBalanceOf", () => {
    const expectedResult = 4294967295n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.assetsBalanceOf.mockResolvedValue(expectedResult)
      result = await acreBTC.assetsBalanceOf(staker)
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

        result = await acreBTC.calculateDepositFee(amount)
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

        await acreBTC.calculateDepositFee(amount)

        result = await acreBTC.calculateDepositFee(amount)
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

        result = await acreBTC.calculateWithdrawalFee(amount)
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

        await acreBTC.calculateWithdrawalFee(amount)

        result = await acreBTC.calculateWithdrawalFee(amount)
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
      const result = acreBTC.getChainIdentifier()

      expect(
        result.equals(EthereumAddress.from(acreBTCContract.address)),
      ).toBeTruthy()
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

      result = acreBTC.encodeApproveAndCallFunctionData(
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

      result = await acreBTC.previewRedeem(shares)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.previewRedeem).toHaveBeenCalledWith(shares)
    })

    it("should return the amount of tBTC that will be redeemed for the given amount of acreBTC shares.", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("convertToShares", () => {
    const expectedResult = 2000n
    const tbtcAmount = 10n
    let result: bigint

    beforeAll(async () => {
      mockedContractInstance.convertToShares.mockResolvedValue(expectedResult)

      result = await acreBTC.convertToShares(tbtcAmount)
    })

    it("should call ethers contract instance", () => {
      expect(mockedContractInstance.convertToShares).toHaveBeenCalledWith(
        tbtcAmount,
      )
    })

    it("should convert tBTC amount to acreBTC shares", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("encodeRequestRedeemFunctionData", () => {
    const shares = 10n
    const receiverEvmAddress = "0x999333A67C9B55E78B97b9C0b287EB4AAeBa3D3b"
    const receiver = EthereumAddress.from(receiverEvmAddress)
    const owner = EthereumAddress.from(
      "0x8FF2A98c1F08FD5a4D12bED447b90d4de045C10b",
    )
    const mockedEncodedData = "0xdeadbeef"
    let result: Hex

    beforeAll(() => {
      mockedContractInstance.interface.encodeFunctionData.mockReturnValue(
        mockedEncodedData,
      )

      result = acreBTC.encodeRequestRedeemFunctionData(
        shares,
        receiverEvmAddress,
        owner,
      )
    })

    it("should encode a `requestRedeem` call - no approval is involved", () => {
      expect(
        mockedContractInstance.interface.encodeFunctionData,
      ).toHaveBeenLastCalledWith("requestRedeem", [
        shares,
        `0x${receiver.identifierHex}`,
        `0x${owner.identifierHex}`,
      ])
    })

    it("should return the encoded data", () => {
      expect(result.toPrefixedString()).toEqual(mockedEncodedData)
    })

    it("should reject a receiver that is not a valid Ethereum address", () => {
      expect(() =>
        acreBTC.encodeRequestRedeemFunctionData(
          shares,
          "not-an-address",
          owner,
        ),
      ).toThrow()
    })
  })

  describe("findRedemptionRequestIdFromTransaction", () => {
    const txHash = Hex.from(
      "0x6ecf70666399edf65fc1e159b22fbb48cf0e389e84fdbb3550a7366d9af7efff",
    )
    const mockedRedemptionRequestedEventTopic =
      "0x46949ee51143d5b58e4df83122d6c382a04f7bffbe563f78cd7fa61ee519ec08"

    beforeAll(() => {
      jest
        .spyOn(mockedContractInstance.interface, "getEvent")
        .mockReturnValue({ topicHash: mockedRedemptionRequestedEventTopic })
    })

    describe("when cannot find the tx receipt", () => {
      beforeAll(() => {
        jest
          .spyOn(mockedRunner.provider!, "getTransactionReceipt")
          .mockResolvedValueOnce(null)
      })

      it("should throw an error", async () => {
        await expect(
          acreBTC.findRedemptionRequestIdFromTransaction(txHash),
        ).rejects.toThrow(
          `Cannot find the redemption request id. Transaction with hash ${txHash.toPrefixedString()} not found`,
        )
      })
    })

    describe("when the transaction exists", () => {
      beforeAll(() => {
        jest
          .spyOn(mockedRunner.provider!, "getTransactionReceipt")
          .mockResolvedValueOnce({ logs: [] } as unknown as TransactionReceipt)
      })

      describe("when the `RedemptionRequested` event does not exist", () => {
        it("should throw an error", async () => {
          await expect(
            acreBTC.findRedemptionRequestIdFromTransaction(txHash),
          ).rejects.toThrow(
            "Cannot find the redemption request id. The RedemptionRequested event not found",
          )
        })
      })

      describe("when the `RedemptionRequested` event exists", () => {
        const mockedRedemptionRequestId = 1n
        const mockedRedemptionRequestedLog = {
          topics: [mockedRedemptionRequestedEventTopic],
        }
        let result: bigint

        beforeAll(async () => {
          jest
            .spyOn(mockedRunner.provider!, "getTransactionReceipt")
            .mockResolvedValue({
              logs: [mockedRedemptionRequestedLog],
            } as unknown as TransactionReceipt)

          // Read by name, not by position - the acreBTC event puts the request
          // id first, unlike the `BitcoinRedeemer` event of the same name.
          jest
            .spyOn(mockedContractInstance.interface, "parseLog")
            .mockReturnValue({
              args: { requestId: mockedRedemptionRequestId },
            })

          result = await acreBTC.findRedemptionRequestIdFromTransaction(txHash)
        })

        it("should find the transaction receipt", () => {
          expect(
            mockedRunner.provider?.getTransactionReceipt,
          ).toHaveBeenCalledWith(txHash.toPrefixedString())
        })

        it("should get the event signature", () => {
          expect(
            mockedContractInstance.interface.getEvent,
          ).toHaveBeenCalledWith("RedemptionRequested")
        })

        it("should parse log", () => {
          expect(
            mockedContractInstance.interface.parseLog,
          ).toHaveBeenCalledWith(mockedRedemptionRequestedLog)
        })

        it("should return the redemption request id", () => {
          expect(result).toEqual(mockedRedemptionRequestId)
        })

        describe("when `RedemptionRequested` log can't be parsed", () => {
          beforeAll(() => {
            jest
              .spyOn(mockedContractInstance.interface, "parseLog")
              .mockReturnValue(null)
          })

          it("should throw an error", async () => {
            await expect(
              acreBTC.findRedemptionRequestIdFromTransaction(txHash),
            ).rejects.toThrow(
              "Cannot find the redemption request id. Cannot parse log",
            )
          })
        })
      })
    })
  })
})
