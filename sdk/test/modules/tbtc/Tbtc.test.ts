import {
  BitcoinAddressConverter,
  BitcoinHashUtils,
  EthereumAddress,
  EthereumBridge,
  RedeemerProxy,
  TBTC as TbtcSdk,
  Deposit as TbtcSdkDeposit,
} from "@keep-network/tbtc-v2.ts"

import { ethers } from "ethers"
import { ethers as ethersV5 } from "ethers-v5"
import { Hex, BitcoinNetwork } from "../../../src"
import Deposit from "../../../src/modules/tbtc/Deposit"
import TbtcApi from "../../../src/lib/api/TbtcApi"

import Tbtc from "../../../src/modules/tbtc"
import {
  depositTestData,
  receiptTestData,
  revealTestData,
  tbtcApiDeposits,
} from "../../data/deposit"
import { MockAcreContracts } from "../../utils/mock-acre-contracts"

import { MockTbtcSdk } from "../../utils/mock-tbtc-sdk"

jest.mock("@keep-network/tbtc-v2.ts", (): object => ({
  TbtcSdk: jest.fn(),
  ...jest.requireActual("@keep-network/tbtc-v2.ts"),
}))

describe("Tbtc", () => {
  const tbtcApiUrl = "https://api.acre.fi/v1/deposit/"

  // @ts-expect-error we only mock the methods used in our SDK.
  const tbtcSdk: TbtcSdk = new MockTbtcSdk()

  const { bitcoinDepositor } = new MockAcreContracts()
  const tbtcApi: TbtcApi = new TbtcApi(tbtcApiUrl)
  const mockedSigner = {} as ethersV5.VoidSigner

  let tbtc: Tbtc

  beforeAll(() => {
    jest.spyOn(ethersV5, "VoidSigner").mockReturnValue(mockedSigner)
    tbtc = new Tbtc(tbtcApi, tbtcSdk, bitcoinDepositor, BitcoinNetwork.Testnet)
  })

  describe("initialize", () => {
    const ethereumRpcUrl = "https://test.com"

    describe("when network is mainnet", () => {
      const network: BitcoinNetwork = BitcoinNetwork.Mainnet

      let result: Tbtc

      beforeAll(async () => {
        jest.spyOn(TbtcSdk, "initializeMainnet").mockResolvedValueOnce(tbtcSdk)
        result = await Tbtc.initialize(
          network,
          ethereumRpcUrl,
          tbtcApiUrl,
          bitcoinDepositor,
        )
      })

      it("should initialize TbtcSdk for mainnet", () => {
        expect(TbtcSdk.initializeMainnet).toHaveBeenCalledWith(mockedSigner)
      })

      it("should return initialized Tbtc module", () => {
        expect(result).toBeInstanceOf(Tbtc)
      })
    })

    describe("when network is testnet", () => {
      const network: BitcoinNetwork = BitcoinNetwork.Testnet

      let result: Tbtc

      beforeAll(async () => {
        jest.spyOn(TbtcSdk, "initializeSepolia").mockResolvedValueOnce(tbtcSdk)

        result = await Tbtc.initialize(
          network,
          ethereumRpcUrl,
          tbtcApiUrl,
          bitcoinDepositor,
        )
      })

      it("should initialize TbtcSdk for sepolia", () => {
        expect(TbtcSdk.initializeSepolia).toHaveBeenCalledWith(mockedSigner)
      })

      it("should return initialized Tbtc module", () => {
        expect(result).toBeInstanceOf(Tbtc)
      })
    })
  })

  describe("initiateDeposit", () => {
    describe("when Bitcoin address is empty", () => {
      it("should throw an error", async () => {
        const emptyBitcoinRecoveryAddress = ""

        await expect(
          tbtc.initiateDeposit(
            depositTestData.depositOwner,
            emptyBitcoinRecoveryAddress,
            depositTestData.referral,
          ),
        ).rejects.toThrow("Ethereum or Bitcoin address is not available")
      })
    })

    describe("when Bitcoin address is provided", () => {
      beforeAll(() => {
        bitcoinDepositor.encodeExtraData = jest
          .fn()
          .mockReturnValue(depositTestData.extraData)

        const tbtcSdkDeposit: TbtcSdkDeposit =
          jest.fn() as unknown as TbtcSdkDeposit

        tbtcSdkDeposit.getReceipt = jest.fn().mockReturnValue(receiptTestData)

        tbtcSdk.deposits.initiateDepositWithProxy = jest
          .fn()
          .mockReturnValue(tbtcSdkDeposit)
      })

      describe("when saveReveal succeeded", () => {
        let result: Deposit

        beforeAll(async () => {
          jest.spyOn(tbtcApi, "saveReveal").mockResolvedValueOnce(true)

          result = await tbtc.initiateDeposit(
            depositTestData.depositOwner,
            depositTestData.bitcoinRecoveryAddress,
            depositTestData.referral,
          )
        })

        it("should call saveReveal", () => {
          expect(tbtcApi.saveReveal).toHaveBeenCalledWith(revealTestData)
        })

        it("should initiate a deposit", () => {
          expect(result).toBeInstanceOf(Deposit)
        })
      })

      describe("when saveReveal failed", () => {
        beforeAll(() => {
          jest.spyOn(tbtcApi, "saveReveal").mockResolvedValueOnce(false)
        })

        it("should throw an error", async () => {
          await expect(
            tbtc.initiateDeposit(
              depositTestData.depositOwner,
              depositTestData.bitcoinRecoveryAddress,
              depositTestData.referral,
            ),
          ).rejects.toThrow("Reveal not saved properly in the database")
        })
      })
    })
  })

  describe("getDepositsByOwner", () => {
    const depositOwner = EthereumAddress.from(
      ethers.Wallet.createRandom().address,
    )
    const spyOnSolidityPackedKeccak256 = jest.spyOn(
      ethers,
      "solidityPackedKeccak256",
    )

    let result: Awaited<ReturnType<Tbtc["getDepositsByOwner"]>>

    beforeAll(async () => {
      jest
        .spyOn(tbtcApi, "getDepositsByOwner")
        .mockResolvedValueOnce(tbtcApiDeposits)

      result = await tbtc.getDepositsByOwner(depositOwner)
    })

    it("should get deposits from tbtc api", () => {
      expect(tbtcApi.getDepositsByOwner).toHaveBeenCalledWith(depositOwner)
    })

    it("should add a deposit key to each deposit", () => {
      const deposit1 = tbtcApiDeposits[0]
      const deposit2 = tbtcApiDeposits[1]

      expect(spyOnSolidityPackedKeccak256).toHaveBeenCalledTimes(2)
      expect(spyOnSolidityPackedKeccak256).toHaveBeenNthCalledWith(
        1,
        ["bytes32", "uint32"],
        [
          Hex.from(deposit1.txHash).reverse().toPrefixedString(),
          deposit1.outputIndex,
        ],
      )
      expect(spyOnSolidityPackedKeccak256).toHaveBeenNthCalledWith(
        2,
        ["bytes32", "uint32"],
        [
          Hex.from(deposit2.txHash).reverse().toPrefixedString(),
          deposit2.outputIndex,
        ],
      )
    })

    it("should return correct data", () => {
      const deposit1 = tbtcApiDeposits[0]
      const deposit2 = tbtcApiDeposits[1]

      expect(result).toStrictEqual([
        {
          status: deposit1.status,
          initialAmount: BigInt(deposit1.initialAmount),
          depositKey:
            "0x9d7edf34dd3a687437ec637f7495cde408846d1308b5ca0ade907b06c07f0be7",
          txHash: deposit1.txHash,
          initializedAt: deposit1.createdAt,
        },
        {
          status: deposit2.status,
          initialAmount: BigInt(deposit2.initialAmount),
          depositKey:
            "0xcc465e44028f920712f67e48da2e2f6d1e28dacfa7d1e4c7c73cfec250c499d6",
          txHash: deposit2.txHash,
          initializedAt: deposit2.createdAt,
        },
      ])
    })
  })

  describe("initiateRedemption", () => {
    const destinationBitcoinAddress =
      "tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx"
    const redeemerOutputScript = Hex.from(
      "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
    )
    const walletPublicKey = Hex.from(
      "03989d253b17a6a0f41838b84ff0d20e8898f9d7b1a98f2564da4cc29dcf8581d9",
    )
    const walletPublicKeyHash = Hex.from(
      "8db50eb52063ea9d98b3eac91489a90f738986f6",
    )
    const tbtcAmount = 10000n
    const redeemer = {} as RedeemerProxy

    const expectedRedemptionKey =
      "0xb7466077357653f26ca2dbbeb43b9609c9603603413284d44548e0efcb75af20"
    const mockedTxHash = Hex.from(
      "0x7e19682ec2411f26393a3ec55a9483253f4a5150a53aa6f82e069ec78d829f5d",
    )

    const spyOnBuildRedemptionKey = jest.spyOn(
      EthereumBridge,
      "buildRedemptionKey",
    )
    const spyOnAddressToOutputScript = jest.spyOn(
      BitcoinAddressConverter,
      "addressToOutputScript",
    )

    const spyOnComputeHash160 = jest.spyOn(BitcoinHashUtils, "computeHash160")

    let result: Awaited<ReturnType<Tbtc["initiateRedemption"]>>

    beforeAll(async () => {
      tbtcSdk.redemptions.requestRedemptionWithProxy = jest
        .fn()
        .mockResolvedValueOnce({
          targetChainTxHash: mockedTxHash,
          walletPublicKey,
        })
      result = await tbtc.initiateRedemption(
        destinationBitcoinAddress,
        tbtcAmount,
        redeemer,
      )
    })

    it("should call redemption service", () => {
      expect(
        tbtcSdk.redemptions.requestRedemptionWithProxy,
      ).toHaveBeenLastCalledWith(
        destinationBitcoinAddress,
        tbtcAmount,
        redeemer,
      )
    })

    it("should convert the destination bitcoin address to output script", () => {
      expect(spyOnAddressToOutputScript).toHaveBeenCalledWith(
        destinationBitcoinAddress,
        BitcoinNetwork.Testnet,
      )

      expect(spyOnAddressToOutputScript).toHaveReturnedWith(
        redeemerOutputScript,
      )
    })

    it("should compute wallet public key hash", () => {
      expect(spyOnComputeHash160).toHaveBeenCalledWith(walletPublicKey)
    })

    it("should build redemption key", () => {
      expect(spyOnBuildRedemptionKey).toHaveBeenCalledWith(
        walletPublicKeyHash,
        redeemerOutputScript,
      )
    })

    it("should return the transaction hash and redemption key", () => {
      expect(result.transactionHash).toBe(mockedTxHash.toPrefixedString())
      expect(result.redemptionKey).toBe(expectedRedemptionKey)
    })
  })
})
