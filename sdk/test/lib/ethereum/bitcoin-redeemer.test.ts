import ethers, { Contract, TransactionReceipt } from "ethers"
import BitcoinRedeemer from "@acre-btc/contracts/deployments/sepolia/BitcoinRedeemerV2.json"
import {
  EthereumAddress,
  EthereumContractRunner,
  EthereumBitcoinRedeemer,
} from "../../../src/lib/ethereum"
import TbtcBridge from "../../../src/lib/ethereum/tbtc-bridge"
import { Hex } from "../../../src/lib/utils"
import { RedeemerWithdrawalFees } from "../../../src/lib/contracts"

jest.mock("ethers", (): object => ({
  Contract: jest.fn(),
  ...jest.requireActual("ethers"),
}))

jest.mock(
  "@acre-btc/contracts/deployments/sepolia/BitcoinRedeemerV2.json",
  () => ({
    address: "0xEa887C9de098BD7110EA638cEc91cc8d345b06C0",
    abi: [],
  }),
)

const testData = {
  redemptionParameters: {
    redemptionTreasuryFeeDivisor: 2_000n, // 1/2000 == 5bps == 0.05% == 0.0005
  },
}

describe("BitcoinRedeemer", () => {
  let bitcoinRedeemer: EthereumBitcoinRedeemer
  const mockedContractInstance = {
    interface: {
      getEvent: jest.fn(),
      parseLog: jest.fn(),
    },
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

    bitcoinRedeemer = new EthereumBitcoinRedeemer(
      {
        runner: mockedRunner,
      },
      "sepolia",
    )
  })

  describe("getChainIdentifier", () => {
    it("should return contract address", () => {
      const result = bitcoinRedeemer.getChainIdentifier()

      expect(
        result.equals(EthereumAddress.from(BitcoinRedeemer.address)),
      ).toBeTruthy()
    })
  })

  describe("calculateWithdrawalFee", () => {
    const mockedBridgeContractInstance = {
      redemptionParameters: jest
        .fn()
        .mockResolvedValue(testData.redemptionParameters),
    }

    const amountToWithdraw = 100000000000000000n // 0.1 in 1e18 token precision

    const expectedResult = {
      tbtc: {
        treasuryFee: 50000000000000n,
      },
    }

    beforeAll(() => {
      bitcoinRedeemer.setTbtcContracts({
        tbtcBridge: mockedBridgeContractInstance as unknown as TbtcBridge,
      })
    })

    describe("when network fees are not yet cached", () => {
      let result: RedeemerWithdrawalFees

      beforeAll(async () => {
        result = await bitcoinRedeemer.calculateWithdrawalFee(amountToWithdraw)
      })

      it("should get the redemption parameters from chain", () => {
        expect(
          mockedBridgeContractInstance.redemptionParameters,
        ).toHaveBeenCalled()
      })

      it("should return correct fees", () => {
        expect(result).toMatchObject(expectedResult)
      })
    })

    describe("when network fees are already cached", () => {
      let result: RedeemerWithdrawalFees

      beforeAll(async () => {
        mockedBridgeContractInstance.redemptionParameters.mockClear()

        result = await bitcoinRedeemer.calculateWithdrawalFee(amountToWithdraw)
      })

      it("should get the deposit parameters from cache", () => {
        expect(
          mockedBridgeContractInstance.redemptionParameters,
        ).toHaveBeenCalledTimes(0)
      })

      it("should return correct fees", () => {
        expect(result).toMatchObject(expectedResult)
      })
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
          bitcoinRedeemer.findRedemptionRequestIdFromTransaction(txHash),
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
            bitcoinRedeemer.findRedemptionRequestIdFromTransaction(txHash),
          ).rejects.toThrow(
            "Cannot find the redemption request id. The RedemptionRequested event not found",
          )
        })
      })

      describe("when the `RedemptionRequested` event exists", () => {
        const mockedRedemptionRequestId = 1n
        const mockedLogRedemptionRequestedLog = {
          topics: [mockedRedemptionRequestedEventTopic],
        }
        let result: bigint
        beforeAll(async () => {
          jest
            .spyOn(mockedRunner.provider!, "getTransactionReceipt")
            .mockResolvedValue({
              logs: [mockedLogRedemptionRequestedLog],
            } as unknown as TransactionReceipt)

          jest
            .spyOn(mockedContractInstance.interface, "parseLog")
            .mockReturnValue({ args: ["", mockedRedemptionRequestId] })

          result =
            await bitcoinRedeemer.findRedemptionRequestIdFromTransaction(txHash)
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
          ).toHaveBeenCalledWith(mockedLogRedemptionRequestedLog)
        })

        it("should return the redemption request id", () => {
          expect(result.toString()).toBe(mockedRedemptionRequestId.toString())
        })

        describe("when `RedemptionRequested` log can't be parsed", () => {
          beforeAll(() => {
            jest
              .spyOn(mockedContractInstance.interface, "parseLog")
              .mockReturnValue(null)
          })

          it("should throw an error", async () => {
            await expect(
              bitcoinRedeemer.findRedemptionRequestIdFromTransaction(txHash),
            ).rejects.toThrow(
              "Cannot find the redemption request id. Cannot parse log",
            )
          })
        })
      })
    })
  })
})
