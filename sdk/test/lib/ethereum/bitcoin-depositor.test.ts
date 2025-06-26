import ethers, { Contract, ZeroAddress, getAddress } from "ethers"
import {
  EthereumBitcoinDepositor,
  EthereumAddress,
  EthereumContractRunner,
} from "../../../src/lib/ethereum"
import { DepositFees } from "../../../src"
import { extraDataValidTestData } from "./data"
import TbtcBridge from "../../../src/lib/ethereum/tbtc-bridge"
import TbtcVault from "../../../src/lib/ethereum/tbtc-vault"
import ERC20Token from "../../../src/lib/ethereum/erc20-token"

jest.mock("ethers", (): object => ({
  Contract: jest.fn(),
  ...jest.requireActual("ethers"),
}))

const testData = {
  depositorFeeDivisor: 1000n,
  depositParameters: {
    depositTreasuryFeeDivisor: 2_000n, // 1/2000 == 5bps == 0.05% == 0.0005
    depositTxMaxFee: 100_000n, // 100000 satoshi = 0.001 BTC
  },
  optimisticMintingFeeDivisor: 500n, // 1/500 = 0.002 = 0.2%
}

describe("BitcoinDepositor", () => {
  const spyOnEthersDataSlice = jest.spyOn(ethers, "dataSlice")
  const spyOnEthersContract = jest.spyOn(ethers, "Contract")
  const signer = {} as EthereumContractRunner

  const vaultAddress = EthereumAddress.from(
    ethers.Wallet.createRandom().address,
  )
  const bridgeAddress = EthereumAddress.from(
    ethers.Wallet.createRandom().address,
  )
  const reimbursementPoolAddress = EthereumAddress.from(
    ethers.Wallet.createRandom().address,
  )

  const minDepositAmount = BigInt(0.015 * 1e18)

  const mockedContractInstance = {
    tbtcVault: jest
      .fn()
      .mockImplementation(() => `0x${vaultAddress.identifierHex}`),
    initializeDeposit: jest.fn(),
    bridge: jest.fn().mockResolvedValue(`0x${bridgeAddress.identifierHex}`),
    depositorFeeDivisor: jest
      .fn()
      .mockResolvedValue(testData.depositorFeeDivisor),
    minDepositAmount: jest.fn().mockImplementation(() => minDepositAmount),
    bridgeFeesReimbursementThreshold: jest.fn(),
    feesReimbursementPool: jest
      .fn()
      .mockResolvedValue(`0x${reimbursementPoolAddress.identifierHex}`),
    runner: signer,
  }

  let depositor: EthereumBitcoinDepositor
  let depositorAddress: EthereumAddress

  beforeAll(async () => {
    spyOnEthersContract.mockImplementationOnce(
      () => mockedContractInstance as unknown as Contract,
    )

    // TODO: get the address from artifact imported from `solidity` package.
    depositorAddress = EthereumAddress.from(
      await ethers.Wallet.createRandom().getAddress(),
    )

    depositor = new EthereumBitcoinDepositor(
      {
        runner: signer,
        address: depositorAddress.identifierHex,
      },
      "sepolia",
    )
  })

  describe("getChainIdentifier", () => {
    it("should return contract address", () => {
      const result = depositor.getChainIdentifier()

      expect(result.equals(depositorAddress)).toBeTruthy()
    })
  })

  describe("getTbtcVaultChainIdentifier", () => {
    it("should return correct tBTC vault address", async () => {
      const address = await depositor.getTbtcVaultChainIdentifier()

      expect(address.equals(vaultAddress)).toBeTruthy()
    })
  })

  describe("encodeExtraData", () => {
    const spyOnSolidityPacked = jest.spyOn(ethers, "solidityPacked")

    it.each(extraDataValidTestData)(
      "$testDescription",
      ({ depositOwner, referral, extraData }) => {
        const result = depositor.encodeExtraData(depositOwner, referral)

        expect(spyOnSolidityPacked).toHaveBeenCalledWith(
          ["address", "uint16"],
          [`0x${depositOwner.identifierHex}`, referral],
        )

        expect(result.toPrefixedString()).toEqual(extraData)
      },
    )

    describe("when deposit owner is zero address", () => {
      const depositOwner = EthereumAddress.from(ZeroAddress)

      beforeEach(() => {
        spyOnSolidityPacked.mockClear()
      })

      it("should throw an error", () => {
        expect(() => {
          depositor.encodeExtraData(depositOwner, 0)
        }).toThrow("Invalid deposit owner address")
        expect(spyOnSolidityPacked).not.toHaveBeenCalled()
      })
    })
  })

  describe("decodeExtraData", () => {
    beforeEach(() => {
      spyOnEthersDataSlice.mockClear()
    })

    it.each(extraDataValidTestData)(
      "$testDescription",
      ({
        depositOwner: expectedDepositOwner,
        extraData,
        referral: expectedReferral,
      }) => {
        const { depositOwner, referral } = depositor.decodeExtraData(extraData)

        expect(spyOnEthersDataSlice).toHaveBeenNthCalledWith(
          1,
          extraData,
          0,
          20,
        )

        expect(spyOnEthersDataSlice).toHaveBeenNthCalledWith(
          2,
          extraData,
          20,
          22,
        )

        expect(expectedDepositOwner.equals(depositOwner)).toBeTruthy()
        expect(expectedReferral).toBe(referral)
      },
    )
  })

  describe("calculateDepositFee", () => {
    const mockedBridgeContractInstance = {
      depositParameters: jest
        .fn()
        .mockResolvedValue(testData.depositParameters),
    }

    const mockedVaultContractInstance = {
      optimisticMintingFeeDivisor: jest
        .fn()
        .mockResolvedValue(testData.optimisticMintingFeeDivisor),
    }

    const mockedTbtcTokenContractInstance = {
      // 1 tBTC in 1e18 token precision
      balanceOf: jest.fn().mockResolvedValue(1000000000000000000n),
    }

    const amountToStake = 100000000000000000n // 0.1 in 1e18 token precision

    const expectedResult = {
      tbtc: {
        // The fee is calculated based on the initial funding
        // transaction amount. `amountToStake / depositTreasuryFeeDivisor`
        // 0.00005 tBTC in 1e18 precision.
        treasuryFee: 50000000000000n,
        // Maximum amount of BTC transaction fee that can
        // be incurred by each swept deposit being part of the given sweep
        // transaction.
        // 0.001 tBTC in 1e18 precision.
        depositTxMaxFee: 1000000000000000n,
        // The optimistic fee is a percentage AFTER
        // the treasury fee is cut:
        // `fee = (depositAmount - treasuryFee) / optimisticMintingFeeDivisor`
        // 0.0001999 tBTC in 1e18 precision.
        optimisticMintingFee: 199900000000000n,
      },
      acre: {
        // Divisor used to compute the depositor fee taken from each deposit
        // and transferred to the treasury upon stake request finalization.
        // `depositorFee = depositedAmount / depositorFeeDivisor`
        // 0.0001 tBTC in 1e18 precision.
        bitcoinDepositorFee: 100000000000000n,
      },
    }

    beforeAll(() => {
      spyOnEthersContract.mockClear()

      spyOnEthersContract.mockImplementation((target: string) => {
        if (getAddress(target) === getAddress(bridgeAddress.identifierHex))
          return mockedBridgeContractInstance as unknown as Contract
        if (getAddress(target) === getAddress(vaultAddress.identifierHex))
          return mockedVaultContractInstance as unknown as Contract

        throw new Error("Cannot create mocked contract instance")
      })

      depositor.setTbtcContracts({
        tbtcBridge: mockedBridgeContractInstance as unknown as TbtcBridge,
        tbtcVault: mockedVaultContractInstance as unknown as TbtcVault,
        tbtcToken: mockedTbtcTokenContractInstance as unknown as ERC20Token,
      })
    })

    describe("when network fees are not yet cached", () => {
      describe("when reimbursement threshold is disabled", () => {
        let result: DepositFees

        beforeAll(async () => {
          result = await depositor.calculateDepositFee(amountToStake)
        })

        it("should get the deposit parameters from chain", () => {
          expect(
            mockedBridgeContractInstance.depositParameters,
          ).toHaveBeenCalled()
        })

        it("should get the optimistic minting fee divisor", () => {
          expect(
            mockedVaultContractInstance.optimisticMintingFeeDivisor,
          ).toHaveBeenCalled()
        })

        it("should get the depositor fee divisor", () => {
          expect(mockedContractInstance.depositorFeeDivisor).toHaveBeenCalled()
        })

        it("should get the reimbursement threshold", () => {
          expect(
            mockedContractInstance.bridgeFeesReimbursementThreshold,
          ).toHaveBeenCalled()
        })

        it("should return correct fees", () => {
          expect(result).toMatchObject({
            ...expectedResult,
            tbtc: { ...expectedResult.tbtc, reimbursableFee: 0n },
          })
        })
      })

      describe("when reimbursement threshold is enabled", () => {
        beforeAll(() => {
          // 0.2 tBTC in 1e18 token precision
          mockedContractInstance.bridgeFeesReimbursementThreshold.mockResolvedValue(
            200000000000000000n,
          )
        })

        describe("when the reimbursement threshold amount is greater than deposit amount", () => {
          describe("when the reimbursement pool has sufficient tBTC balance", () => {
            let result: DepositFees

            beforeAll(async () => {
              // 1 tBTC in 1e18 token precision
              mockedTbtcTokenContractInstance.balanceOf.mockResolvedValue(
                1000000000000000000n,
              )
              result = await depositor.calculateDepositFee(amountToStake)
            })

            it("should fetch the reimbursement pool address", () => {
              expect(
                mockedContractInstance.feesReimbursementPool,
              ).toHaveBeenCalled()
            })

            it("should fetch the tBTC balance of reimbursement pool", () => {
              expect(
                mockedTbtcTokenContractInstance.balanceOf,
              ).toHaveBeenCalledWith(reimbursementPoolAddress)
            })

            it("should return correct fees", () => {
              const totalFee =
                expectedResult.tbtc.depositTxMaxFee +
                expectedResult.tbtc.optimisticMintingFee +
                expectedResult.tbtc.treasuryFee
              expect(result).toMatchObject({
                ...expectedResult,
                tbtc: { ...expectedResult.tbtc, reimbursableFee: totalFee },
              })
            })
          })

          describe("when the reimbursement pool can partially cover fees", () => {
            let result: DepositFees

            // 0,0001 tBTC in 1e18 token precision
            const reimbursementPoolTbtcBalance = 100000000000000n

            beforeAll(async () => {
              mockedTbtcTokenContractInstance.balanceOf.mockResolvedValue(
                reimbursementPoolTbtcBalance,
              )
              result = await depositor.calculateDepositFee(amountToStake)
            })

            it("should return correct fees", () => {
              expect(result).toMatchObject({
                ...expectedResult,
                tbtc: {
                  ...expectedResult.tbtc,
                  reimbursableFee: reimbursementPoolTbtcBalance,
                },
              })
            })
          })

          describe("when the tBTC balance of reimbursement pool is 0", () => {
            let result: DepositFees

            const reimbursementPoolTbtcBalance = 0n

            beforeAll(async () => {
              mockedTbtcTokenContractInstance.balanceOf.mockResolvedValue(
                reimbursementPoolTbtcBalance,
              )

              result = await depositor.calculateDepositFee(amountToStake)
            })

            it("should return correct fees", () => {
              expect(result).toMatchObject({
                ...expectedResult,
                tbtc: {
                  ...expectedResult.tbtc,
                  reimbursableFee: 0n,
                },
              })
            })
          })
        })

        describe("when the deposit amount is greater than reimbursement threshold amount", () => {
          let result: DepositFees

          beforeAll(async () => {
            mockedContractInstance.bridgeFeesReimbursementThreshold.mockResolvedValue(
              amountToStake - 1n,
            )
            result = await depositor.calculateDepositFee(amountToStake)
          })

          it("should return correct fees", () => {
            expect(result).toMatchObject({
              ...expectedResult,
              tbtc: {
                ...expectedResult.tbtc,
                reimbursableFee: 0n,
              },
            })
          })
        })
      })
    })

    describe("when network fees are already cached", () => {
      let result2: DepositFees

      beforeAll(async () => {
        mockedContractInstance.bridge.mockClear()
        mockedContractInstance.tbtcVault.mockClear()
        mockedContractInstance.depositorFeeDivisor.mockClear()
        mockedBridgeContractInstance.depositParameters.mockClear()
        mockedVaultContractInstance.optimisticMintingFeeDivisor.mockClear()

        result2 = await depositor.calculateDepositFee(amountToStake)
      })

      it("should get the deposit parameters from cache", () => {
        expect(mockedContractInstance.bridge).toHaveBeenCalledTimes(0)
        expect(
          mockedBridgeContractInstance.depositParameters,
        ).toHaveBeenCalledTimes(0)
      })

      it("should get the optimistic minting fee divisor from cache", () => {
        expect(mockedContractInstance.tbtcVault).toHaveBeenCalledTimes(0)
        expect(
          mockedVaultContractInstance.optimisticMintingFeeDivisor,
        ).toHaveBeenCalledTimes(0)
      })

      it("should get the bitcoin depositor fee divisor from cache", () => {
        expect(
          mockedContractInstance.depositorFeeDivisor,
        ).toHaveBeenCalledTimes(0)
      })

      it("should return correct fees", () => {
        expect(result2).toMatchObject(expectedResult)
      })
    })
  })

  describe("minDepositAmount", () => {
    it("should return minimum deposit amount", async () => {
      const result = await depositor.minDepositAmount()

      expect(result).toEqual(minDepositAmount)
    })
  })

  describe("bridgeFeesReimbursementThreshold", () => {
    const bridgeFeesReimbursementThreshold = 1n

    beforeAll(() => {
      mockedContractInstance.bridgeFeesReimbursementThreshold.mockResolvedValue(
        bridgeFeesReimbursementThreshold,
      )
    })
    it("should return reimbursement threshold correctly", async () => {
      const result = await depositor.bridgeFeesReimbursementThreshold()

      expect(result).toEqual(bridgeFeesReimbursementThreshold)
    })
  })
})
