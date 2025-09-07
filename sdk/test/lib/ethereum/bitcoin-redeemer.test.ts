import { ethers, Contract } from "ethers"
import BitcoinRedeemer from "@acre-btc/contracts/deployments/sepolia/BitcoinRedeemer.json"
import {
  EthereumAddress,
  EthereumContractRunner,
  EthereumBitcoinRedeemer,
} from "../../../src/lib/ethereum"
import TbtcBridge from "../../../src/lib/ethereum/tbtc-bridge"
import { WithdrawalFees } from "../../../src/lib/contracts"
import { Hex } from "../../../src/lib/utils"

jest.mock("ethers", (): object => ({
  Contract: jest.fn(),
  ...jest.requireActual("ethers"),
}))

jest.mock(
  "@acre-btc/contracts/deployments/sepolia/BitcoinRedeemer.json",
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

  const mockedContractInstance = {}

  beforeAll(() => {
    jest
      .spyOn(ethers, "Contract")
      .mockImplementationOnce(
        () => mockedContractInstance as unknown as Contract,
      )

    bitcoinRedeemer = new EthereumBitcoinRedeemer(
      {
        runner: {} as EthereumContractRunner,
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
      let result: WithdrawalFees

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
      let result: WithdrawalFees

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

  describe("encodeReceiveApprovalExtraData", () => {
    const redeemer = EthereumAddress.from(ethers.Wallet.createRandom().address)
    const redeemerOutputScript = Hex.from(
      "16001473167C206A13859666C2C3204D8D435185C04C56",
    )

    const spyOnDefaultAbiCoder = jest.spyOn(
      ethers.AbiCoder.defaultAbiCoder(),
      "encode",
    )

    let result: Hex

    beforeAll(() => {
      result = bitcoinRedeemer.encodeReceiveApprovalExtraData(
        redeemer,
        redeemerOutputScript,
      )
    })

    it("should call the encode function from default abi coder", () => {
      expect(spyOnDefaultAbiCoder).toHaveBeenCalledWith(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          `0x${redeemer.identifierHex}`,
          // The Ethereum address is 20 bytes so we can use it as "empty" ` bytes20`
          // type.
          ethers.ZeroAddress,
          ethers.encodeBytes32String(""),
          0,
          0,
          redeemerOutputScript.toPrefixedString(),
        ],
      )
    })

    it("should encode data correctly", () => {
      const [decodedRedeemer, , , , , decodedRedeemerOutputScript] =
        ethers.AbiCoder.defaultAbiCoder().decode(
          ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
          result.toPrefixedString(),
        )

      expect(
        redeemer.equals(EthereumAddress.from(decodedRedeemer as string)),
      ).toBeTruthy()
      expect(redeemerOutputScript.toPrefixedString()).toBe(
        decodedRedeemerOutputScript,
      )
    })
  })
})
