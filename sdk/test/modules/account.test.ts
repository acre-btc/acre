import {
  BitcoinAddressConverter,
  BitcoinTxHash,
} from "@keep-network/tbtc-v2.ts"
import { OrangeKitSdk } from "@orangekit/sdk"
import { ethers } from "ethers"
import {
  AcreContracts,
  Hex,
  Account,
  DepositStatus,
  StakeInitialization,
} from "../../src"
import { EthereumAddress } from "../../src/lib/ethereum"
import { MockAcreContracts } from "../utils/mock-acre-contracts"
import { MockTbtc } from "../utils/mock-tbtc"
import { DepositReceipt } from "../../src/modules/tbtc"
import AcreSubgraphApi from "../../src/lib/api/AcreSubgraphApi"
import * as satoshiConverter from "../../src/lib/utils/satoshi-converter"
import { MockBitcoinProvider } from "../utils/mock-bitcoin-provider"
import { MockOrangeKitSdk } from "../utils/mock-orangekit"

const stakingModuleData: {
  initializeDeposit: {
    referral: number
    extraData: Hex
    mockedDepositBTCAddress: string
    bitcoinDepositorAddress: string
    predictedEthereumDepositorAddress: EthereumAddress
  }
} = {
  initializeDeposit: {
    referral: 1,

    extraData: Hex.from(
      "0xeb098d6cde6a202981316b24b19e64d82721e89e4d0000000000000000000000",
    ),
    mockedDepositBTCAddress:
      "tb1qma629cu92skg0t86lftyaf9uflzwhp7jk63h6mpmv3ezh6puvdhs6w2r05",
    bitcoinDepositorAddress: "mjc2zGWypwpNyDi4ZxGbBNnUA84bfgiwYc",
    predictedEthereumDepositorAddress: EthereumAddress.from(
      "0x9996baD9C879B1643Ac921454815F93BadA090AB",
    ),
  },
}

const stakingInitializationData: {
  depositReceipt: Omit<DepositReceipt, "depositor">
  mockedInitializeTxHash: Hex
  mockedDepositId: string
  fundingUtxo: {
    transactionHash: BitcoinTxHash
    outputIndex: number
    value: bigint
  }
} = {
  depositReceipt: {
    blindingFactor: Hex.from("555555"),
    walletPublicKeyHash: Hex.from("666666"),
    refundPublicKeyHash: Hex.from("0x2cd680318747b720d67bf4246eb7403b476adb34"),
    refundLocktime: Hex.from("888888"),
    extraData: stakingModuleData.initializeDeposit.extraData,
  },
  mockedInitializeTxHash: Hex.from("999999"),
  mockedDepositId: "deposit-id-1234",
  fundingUtxo: {
    transactionHash: BitcoinTxHash.from(
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ),
    outputIndex: 1,
    value: 2222n,
  },
}

describe("Account", () => {
  const contracts: AcreContracts = new MockAcreContracts()
  const tbtc = new MockTbtc()
  const acreSubgraph = new AcreSubgraphApi("test")
  const bitcoinProvider = new MockBitcoinProvider()
  const orangeKit: OrangeKitSdk =
    new MockOrangeKitSdk() as unknown as OrangeKitSdk

  const { bitcoinDepositorAddress, predictedEthereumDepositorAddress } =
    stakingModuleData.initializeDeposit

  const accountData = {
    bitcoinAddress: bitcoinDepositorAddress,
    ethereumAddress: predictedEthereumDepositorAddress,
    bitcoinPublicKey: "123456",
  }

  const account: Account = new Account(
    contracts,
    tbtc,
    acreSubgraph,
    accountData,
    bitcoinProvider,
    orangeKit,
  )

  describe("initializeStake", () => {
    const { mockedDepositBTCAddress, referral, extraData } =
      stakingModuleData.initializeDeposit
    // TODO: Rename to `depositor`.
    const staker = predictedEthereumDepositorAddress

    const { mockedDepositId } = stakingInitializationData

    const mockedDeposit = {
      getBitcoinAddress: jest.fn().mockResolvedValue(mockedDepositBTCAddress),
      waitForFunding: jest.fn(),
      getReceipt: jest.fn().mockReturnValue({ extraData }),
      createDeposit: jest.fn().mockReturnValue(mockedDepositId),
    }

    describe.each([
      {
        bitcoinRecoveryAddress: undefined,
        description: "when the bitcoin recovery address is not defined",
      },
      {
        bitcoinRecoveryAddress: "tb1qumuaw3exkxdhtut0u85latkqfz4ylgwstkdzsx",
        description: "when the bitcoin recovery address is defined",
      },
    ])(
      "$description",
      ({ bitcoinRecoveryAddress: _bitcoinRecoveryAddress }) => {
        const mockedSignedMessage = { verify: jest.fn() }
        const bitcoinRecoveryAddress =
          _bitcoinRecoveryAddress ?? bitcoinDepositorAddress

        let result: StakeInitialization

        beforeEach(async () => {
          contracts.bitcoinDepositor.decodeExtraData = jest
            .fn()
            .mockReturnValue({ staker, referral })

          contracts.bitcoinDepositor.encodeExtraData = jest
            .fn()
            .mockReturnValue(extraData)

          tbtc.initiateDeposit = jest.fn().mockReturnValue(mockedDeposit)

          result = await account.initializeStake(
            referral,
            bitcoinRecoveryAddress,
          )
        })

        it("should initiate tBTC deposit", () => {
          expect(tbtc.initiateDeposit).toHaveBeenCalledWith(
            predictedEthereumDepositorAddress,
            bitcoinRecoveryAddress,
            referral,
            bitcoinDepositorAddress,
          )
        })

        it("should return stake initialization object", () => {
          expect(result).toBeInstanceOf(StakeInitialization)
          expect(result.getBitcoinAddress).toBeDefined()
          expect(result.getDepositReceipt).toBeDefined()
          expect(result.stake).toBeDefined()
        })

        describe("StakeInitialization", () => {
          const { depositReceipt } = stakingInitializationData

          beforeAll(() => {
            mockedDeposit.getReceipt.mockReturnValue(depositReceipt)
          })

          describe("getBitcoinAddress", () => {
            it("should return bitcoin deposit address", async () => {
              expect(await result.getBitcoinAddress()).toBe(
                mockedDepositBTCAddress,
              )
            })
          })

          describe("getDepositReceipt", () => {
            it("should return tbtc deposit receipt", () => {
              expect(result.getDepositReceipt()).toBe(depositReceipt)
              expect(mockedDeposit.getReceipt).toHaveBeenCalled()
            })
          })

          describe("stake", () => {
            beforeAll(() => {
              mockedSignedMessage.verify.mockReturnValue(
                predictedEthereumDepositorAddress,
              )
            })

            let depositId: string

            beforeAll(async () => {
              mockedDeposit.waitForFunding.mockResolvedValue(undefined)

              depositId = await result.stake()
            })

            it("should wait for funding", () => {
              expect(mockedDeposit.waitForFunding).toHaveBeenCalled()
            })

            it("should create the deposit", () => {
              expect(mockedDeposit.createDeposit).toHaveBeenCalled()
            })

            it("should return deposit id", () => {
              expect(depositId).toBe(mockedDepositId)
            })
          })
        })
      },
    )
  })

  describe("sharesBalance", () => {
    const depositor = predictedEthereumDepositorAddress

    const expectedResult = 4294967295n

    let result: bigint

    beforeAll(async () => {
      contracts.acreBTC.balanceOf = jest.fn().mockResolvedValue(expectedResult)

      result = await account.sharesBalance()
    })

    it("should get balance of acreBTC", () => {
      expect(contracts.acreBTC.balanceOf).toHaveBeenCalledWith(depositor)
    })

    it("should return value of the basis for calculating final BTC balance", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("estimatedBitcoinBalance", () => {
    const mockedAssetsBalance = 1234567891230000000n
    const expectedResult = 123456789n
    const depositor = predictedEthereumDepositorAddress
    const spyOnToSatoshi = jest.spyOn(satoshiConverter, "toSatoshi")

    let result: bigint

    beforeAll(async () => {
      contracts.acreBTC.assetsBalanceOf = jest
        .fn()
        .mockResolvedValue(mockedAssetsBalance)

      result = await account.estimatedBitcoinBalance()
    })

    it("should get staker's balance of tBTC tokens in vault", () => {
      expect(contracts.acreBTC.assetsBalanceOf).toHaveBeenCalledWith(depositor)
    })

    it("should convert to satoshi", () => {
      expect(spyOnToSatoshi).toHaveBeenCalledWith(mockedAssetsBalance)
    })

    it("should return maximum withdraw value", () => {
      expect(result).toEqual(expectedResult)
    })
  })

  describe("getDeposits", () => {
    const finalizedDeposit = {
      subgraph: {
        depositKey:
          "0x73661e3ee3c6c30988800e5fedc081f29c6540505383fcfcd172fd10f3a73139",
        txHash:
          "6bca75ba55334c25064e7bf5333a3b39ed5bb73fb17e73ea9e55e6294e3fbf65",
        initialAmount: BigInt("1040000000000000"),
        amountToDeposit: BigInt("536361040000000"),
        type: "deposit",
        status: DepositStatus.Finalized,
        initializedAt: 1715807188,
        finalizedAt: 1715807188,
      },
      tbtc: {
        depositKey:
          "0x73661e3ee3c6c30988800e5fedc081f29c6540505383fcfcd172fd10f3a73139",
        txHash:
          "6bca75ba55334c25064e7bf5333a3b39ed5bb73fb17e73ea9e55e6294e3fbf65",
        initialAmount: BigInt("1040000000000000"),
        status: DepositStatus.Finalized,
        initializedAt: 1715807188,
        finalizedAt: 1715807188,
      },
    }

    const queuedDeposit = {
      txHash:
        "96c40dcd6ef25bd27f926dc396bb8f8e7365b4746870e2d186ff001d6693a3ff",
      depositKey:
        "0xc6c428b14cf7c3116603b355ad3ddf029ea5119a2699090c80f99b68dd40fea4",
      outputIndex: 0,
      initialAmount: BigInt("1050000000000000"),
      status: DepositStatus.Queued,
      initializedAt: 1715851724,
      finalizedAt: 1715851724,
    }

    const spyOnSubgraphGetDeposits = jest
      .spyOn(acreSubgraph, "getDepositsByOwner")
      .mockResolvedValueOnce([finalizedDeposit.subgraph])

    const expectedDeposits = [
      {
        id: queuedDeposit.depositKey,
        txHash: queuedDeposit.txHash,
        amount: 105000n,
        status: DepositStatus.Queued,
        initializedAt: 1715851724,
        finalizedAt: undefined,
      },
      {
        id: finalizedDeposit.subgraph.depositKey,
        txHash: finalizedDeposit.subgraph.txHash,
        amount: 53636n,
        status: DepositStatus.Finalized,
        initializedAt: 1715807188,
        finalizedAt: 1715807188,
      },
    ]

    let result: Awaited<ReturnType<Account["getDeposits"]>>

    beforeAll(async () => {
      tbtc.getDepositsByOwner = jest
        .fn()
        .mockResolvedValue([queuedDeposit, finalizedDeposit.tbtc])

      result = await account.getDeposits()
    })

    it("should get deposits from subgraph", () => {
      expect(spyOnSubgraphGetDeposits).toHaveBeenCalledWith(
        predictedEthereumDepositorAddress,
      )
    })

    it("should get deposits from tbtc module", () => {
      expect(tbtc.getDepositsByOwner).toHaveBeenCalledWith(
        predictedEthereumDepositorAddress,
      )
    })

    it("should return correct data", () => {
      expect(result).toStrictEqual(expectedDeposits)
    })
  })

  describe("initializeWithdrawal", () => {
    const btcAmount = 10000000n // 0.1 BTC
    const btcAmountIn1e18 = 100000000000000000n

    const spyOnFromSatoshi = jest.spyOn(satoshiConverter, "fromSatoshi")

    const mockedShares = 90000000000000000n // 0.09 stBTC in 1e18 precision
    const spyOnConvertToShares = jest.spyOn(
      contracts.acreBTC,
      "convertToShares",
    )

    const spyOnGetAcreChainIdentifier = jest.spyOn(
      contracts.acreBTC,
      "getChainIdentifier",
    )
    const acreChainIdentifier = EthereumAddress.from(
      ethers.Wallet.createRandom().address,
    )

    const spyOnGetBitcoinRedeemerChainIdentifier = jest.spyOn(
      contracts.bitcoinRedeemer,
      "getChainIdentifier",
    )
    const bitcoinRedeemerChainIdentifier = EthereumAddress.from(
      ethers.Wallet.createRandom().address,
    )

    const spyOnAddressToOutputScript = jest.spyOn(
      BitcoinAddressConverter,
      "addressToOutputScript",
    )
    const redeemerOutputScript = Hex.from(
      "16001473167C206A13859666C2C3204D8D435185C04C56",
    )

    const spyOnEncodeApproveAndCall = jest.spyOn(
      contracts.acreBTC,
      "encodeApproveAndCallFunctionData",
    )
    const safeTxData = Hex.from("123456")

    const redemptionData = Hex.from(
      "0x0000000000000000000000004665ce4697ba6f9572703857fb3d8a0be09295ec944f997c5553a6f3e1028e707c71b5fa0dd3afa700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000017160014e6f9d74726b19b75f16fe1e9feaec048aa4fa1d0000000000000000000",
    )
    const spyOnBuildRedemptionData = jest
      .spyOn(tbtc, "buildRedemptionData")
      .mockReturnValue(redemptionData)

    const spyOnFindRedemptionRequestId = jest.spyOn(
      contracts.bitcoinRedeemer,
      "findRedemptionRequestIdFromTransaction",
    )
    const mockedRedemptionRequestId = 123n

    const spyOnSendTransaction = jest.spyOn(orangeKit, "sendTransaction")
    const mockedTxHash =
      "0xad19f160667d583a2eb0b844e9b4f669354e79f91ff79a4782184841e66ca06a"

    let result: Awaited<ReturnType<Account["initializeWithdrawal"]>>

    beforeEach(async () => {
      spyOnConvertToShares.mockResolvedValue(mockedShares)
      spyOnGetAcreChainIdentifier.mockReturnValue(acreChainIdentifier)
      spyOnGetBitcoinRedeemerChainIdentifier.mockReturnValue(
        bitcoinRedeemerChainIdentifier,
      )
      spyOnAddressToOutputScript.mockReturnValue(redeemerOutputScript)
      spyOnEncodeApproveAndCall.mockReturnValue(safeTxData)
      spyOnFindRedemptionRequestId.mockResolvedValue(mockedRedemptionRequestId)
      spyOnSendTransaction.mockResolvedValue(mockedTxHash)

      result = await account.initializeWithdrawal(btcAmount)
    })

    it("should convert satoshi amount to tBTC 1e18 precision", () => {
      expect(spyOnFromSatoshi).toHaveBeenLastCalledWith(btcAmount)
      expect(spyOnFromSatoshi).toHaveReturnedWith(btcAmountIn1e18)
    })

    it("should convert to shares", () => {
      expect(spyOnConvertToShares).toHaveBeenCalledWith(btcAmountIn1e18)
    })

    it("should get bitcoin redeemer chain identifier", () => {
      expect(spyOnGetBitcoinRedeemerChainIdentifier).toHaveBeenCalled()
      expect(spyOnGetBitcoinRedeemerChainIdentifier).toHaveReturnedWith(
        bitcoinRedeemerChainIdentifier,
      )
    })

    it("should build redemption data via tbtc module", () => {
      expect(spyOnBuildRedemptionData).toHaveBeenCalledWith(
        accountData.ethereumAddress,
        accountData.bitcoinAddress,
      )
    })

    it("should build the safe tx data", () => {
      expect(spyOnEncodeApproveAndCall).toHaveBeenCalledWith(
        bitcoinRedeemerChainIdentifier,
        mockedShares,
        redemptionData,
      )
    })

    it("should send transaction via orange kit", () => {
      expect(spyOnSendTransaction).toHaveBeenCalledWith(
        `0x${acreChainIdentifier.identifierHex}`,
        "0x0",
        safeTxData.toPrefixedString(),
        accountData.bitcoinAddress,
        accountData.bitcoinPublicKey,
        expect.any(Function),
      )
    })
    it("should return the transaction hash and redemption request id", () => {
      expect(result).toStrictEqual({
        transactionHash: mockedTxHash,
        redemptionRequestId: mockedRedemptionRequestId,
      })
    })
  })

  describe("getWithdrawals", () => {
    const withdrawals = [
      {
        id: "0x047078deab9f2325ce5adc483d6b28dfb32547017ffb73f857482b51b622d5eb-1",
        bitcoinTransactionId: Hex.from(
          "0x844b472231eaaeba765e375dad992c7468deaa81b42d2977cebbf441069b2001",
        )
          .reverse()
          .toString(),
        amount: 10000000000000000n,
        initializedAt: 1718871276,
        finalizedAt: 1718871276,
      },
      {
        id: "0xa40df409c4e463cb0c7744df310ad8714a01c40bcf6807cb2b4266ffa0b860ea-1",
        bitcoinTransactionId: undefined,
        amount: 10000000000000000n,
        initializedAt: 1718889168,
        finalizedAt: 1718889168,
      },
    ]

    const spyOnSubgraphGetWithdrawals = jest
      .spyOn(acreSubgraph, "getWithdrawalsByOwner")
      .mockImplementationOnce(() => Promise.resolve(withdrawals))

    const expectedWithdrawals = [
      {
        ...withdrawals[0],
        amount: 1000000n,
        status: "finalized",
      },
      {
        ...withdrawals[1],
        amount: 1000000n,
        status: "initialized",
      },
    ]

    let result: Awaited<ReturnType<Account["getWithdrawals"]>>

    beforeAll(async () => {
      result = await account.getWithdrawals()
    })

    it("should get withdrawals from subgraph", () => {
      expect(spyOnSubgraphGetWithdrawals).toHaveBeenCalledWith(
        predictedEthereumDepositorAddress,
      )
    })

    it("should return correct data", () => {
      expect(result).toMatchObject(expectedWithdrawals)
    })
  })
})
