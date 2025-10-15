import {
  BitcoinAddressConverter,
  BitcoinUtxo,
  ChainIdentifier,
  EthereumAddress,
  TBTC as TbtcSdk,
  Deposit as TbtcSdkDeposit,
} from "@keep-network/tbtc-v2.ts"

import { ethers } from "ethers"
import { ethers as ethersV5, VoidSigner } from "ethers-v5"
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
            depositTestData.loggedInUser,
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
            depositTestData.loggedInUser,
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
              depositTestData.loggedInUser,
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

  describe("buildRedemptionData", () => {
    const bitcoinAddressData = {
      address: "tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx",
      redeemerOutputScript: "0x160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
      outputScriptNotPrependedWithLength: Hex.from(
        "0014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0",
      ),
    }
    const redeemer = EthereumAddress.from(ethers.Wallet.createRandom().address)
    const signer = new VoidSigner(
      `0x${redeemer.identifierHex}`,
      ethersV5.getDefaultProvider("sepolia"),
    )
    const spyOnAddressToOutputScript = jest.spyOn(
      BitcoinAddressConverter,
      "addressToOutputScript",
    )

    let notMockedTbtcSdk: TbtcSdk
    let tbtcModule: Tbtc
    let result: Hex
    let spyOnBuildRequestRedemptionData: jest.SpyInstance<
      Hex,
      [
        redeemer: ChainIdentifier,
        walletPublicKey: Hex,
        mainUtxo: BitcoinUtxo,
        redeemerOutputScript: Hex,
      ]
    >

    beforeAll(async () => {
      notMockedTbtcSdk = await TbtcSdk.initializeSepolia(signer)

      tbtcModule = new Tbtc(
        tbtcApi,
        notMockedTbtcSdk,
        bitcoinDepositor,
        BitcoinNetwork.Testnet,
      )

      spyOnBuildRequestRedemptionData = jest.spyOn(
        notMockedTbtcSdk.tbtcContracts.tbtcToken,
        "buildRequestRedemptionData",
      )

      result = tbtcModule.buildRedemptionData(
        redeemer,
        bitcoinAddressData.address,
      )
    })

    it("should convert bitcoin address to output script not prepended with length", () => {
      expect(spyOnAddressToOutputScript).toHaveBeenCalledWith(
        bitcoinAddressData.address,
        BitcoinNetwork.Testnet,
      )
      expect(spyOnAddressToOutputScript).toHaveReturnedWith(
        bitcoinAddressData.outputScriptNotPrependedWithLength,
      )
    })

    it("should build redemption data via tBTC v2 sdk", () => {
      expect(spyOnBuildRequestRedemptionData).toHaveBeenCalledWith(
        redeemer,
        Hex.from(ethers.ZeroAddress),
        {
          outputIndex: 0,
          transactionHash: Hex.from(ethers.encodeBytes32String("")),
          value: ethersV5.constants.Zero,
        },
        bitcoinAddressData.outputScriptNotPrependedWithLength,
      )
    })

    it("should return the redemption data with length-prefixed redeemer output script ", () => {
      const [decodedRedeemer, , , , , redeemerOutputScript] =
        ethersV5.utils.defaultAbiCoder.decode(
          ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
          result.toPrefixedString(),
        )
      expect(
        EthereumAddress.from(decodedRedeemer as string).equals(redeemer),
      ).toBeTruthy()
      expect(redeemerOutputScript).toMatch(
        bitcoinAddressData.redeemerOutputScript,
      )
    })
  })
})
