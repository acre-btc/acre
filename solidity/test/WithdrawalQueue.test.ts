import { helpers, ethers, upgrades } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import {
  impersonateAccount,
  loadFixture,
  setBalance,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"

import type { ContractTransactionResponse } from "ethers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"

import {
  AcreBTC,
  TestTBTC,
  MidasAllocator,
  MidasVaultStub,
  WithdrawalQueue,
  TBTCVaultStub,
  IERC20,
  type BridgeStub,
} from "../typechain"

import { to1e18, feeOnTotal, feeOnRaw } from "./utils"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

// Helper to create redemption data for tBTC bridge calls
function createRedemptionData(
  redeemer: string,
  redeemerOutputScript: string,
): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
    [
      redeemer,
      `0x${"00".repeat(20)}`,
      `0x${"00".repeat(32)}`,
      0,
      0n,
      redeemerOutputScript,
    ],
  )
}

async function fixture() {
  const {
    tbtc,
    midasVault,
    tbtcVault,
    acreBtc: acreBTC,
    midasAllocator,
    withdrawalQueue,
    tbtcBridge,
  } = await deployment()
  const { deployer, governance, treasury, maintainer } = await getNamedSigners()
  const [depositor, depositor2, thirdParty] = await getUnnamedSigners()

  const midasVaultSharesToken = await ethers.getContractAt(
    "IERC20",
    await midasVault.share(),
  )

  return {
    governance,
    treasury,
    thirdParty,
    depositor,
    depositor2,
    maintainer,
    deployer,
    tbtc,
    acreBtc: acreBTC,
    midasAllocator,
    midasVault,
    midasVaultSharesToken,
    tbtcVault,
    tbtcBridge,
    withdrawalQueue,
  }
}

describe("WithdrawalQueue", () => {
  const exitFeeBasisPoints = 100n // 1%

  let tbtc: TestTBTC
  let acreBTC: AcreBTC
  let midasAllocator: MidasAllocator
  let midasVaultSharesToken: IERC20
  let midasVault: MidasVaultStub
  let tbtcVault: TBTCVaultStub
  let tbtcBridge: BridgeStub
  let withdrawalQueue: WithdrawalQueue

  let thirdParty: HardhatEthersSigner
  let maintainer: HardhatEthersSigner
  let governance: HardhatEthersSigner
  let treasury: HardhatEthersSigner
  let depositor: HardhatEthersSigner
  let depositor2: HardhatEthersSigner
  let tbtcVaultFakeSigner: HardhatEthersSigner

  before(async () => {
    ;({
      thirdParty,
      maintainer,
      governance,
      treasury,
      depositor,
      depositor2,
      tbtc,
      acreBtc: acreBTC,
      midasAllocator,
      midasVault,
      midasVaultSharesToken,
      tbtcVault,
      tbtcBridge,
      withdrawalQueue,
    } = await loadFixture(fixture))

    // Set fees to 0 for simpler testing
    await acreBTC.connect(governance).updateEntryFeeBasisPoints(0)
    await acreBTC.connect(governance).updateExitFeeBasisPoints(0)

    // Impersonate tBTC Vault to test tBTC token ownership checks
    await impersonateAccount(await tbtcVault.getAddress())
    tbtcVaultFakeSigner = await ethers.getSigner(await tbtcVault.getAddress())
    await setBalance(tbtcVaultFakeSigner.address, to1e18(1))
  })

  after(async () => {
    if (tbtcVault) {
      await stopImpersonatingAccount(await tbtcVault.getAddress())
    }
  })

  describe("initialization", () => {
    it("should initialize with correct parameters", async () => {
      expect(await withdrawalQueue.tbtc()).to.equal(await tbtc.getAddress())
      expect(await withdrawalQueue.midasVault()).to.equal(
        await midasVault.getAddress(),
      )
      expect(await withdrawalQueue.midasAllocator()).to.equal(
        await midasAllocator.getAddress(),
      )
      expect(await withdrawalQueue.tbtcVault()).to.equal(
        await tbtcVault.getAddress(),
      )
      expect(await withdrawalQueue.acrebtc()).to.equal(
        await acreBTC.getAddress(),
      )
      expect(await withdrawalQueue.tbtcBridge()).to.equal(
        await tbtcBridge.getAddress(),
      )
      expect(await withdrawalQueue.count()).to.equal(0)
    })

    it("should revert if tbtc address is zero", async () => {
      const WithdrawalQueueFactory =
        await ethers.getContractFactory("WithdrawalQueue")
      await expect(
        upgrades.deployProxy(
          WithdrawalQueueFactory,
          [
            ethers.ZeroAddress,
            await midasVault.getAddress(),
            await midasAllocator.getAddress(),
            await tbtcVault.getAddress(),
            await acreBTC.getAddress(),
            await tbtcBridge.getAddress(),
          ],
          {
            kind: "transparent",
          },
        ),
      ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
    })

    it("should revert if vault address is zero", async () => {
      const WithdrawalQueueFactory =
        await ethers.getContractFactory("WithdrawalQueue")
      await expect(
        upgrades.deployProxy(
          WithdrawalQueueFactory,
          [
            await tbtc.getAddress(),
            ethers.ZeroAddress,
            await midasAllocator.getAddress(),
            await tbtcVault.getAddress(),
            await acreBTC.getAddress(),
            await tbtcBridge.getAddress(),
          ],
          {
            kind: "transparent",
          },
        ),
      ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
    })

    it("should revert if midasAllocator address is zero", async () => {
      const WithdrawalQueueFactory =
        await ethers.getContractFactory("WithdrawalQueue")
      await expect(
        upgrades.deployProxy(
          WithdrawalQueueFactory,
          [
            await tbtc.getAddress(),
            await midasVault.getAddress(),
            ethers.ZeroAddress,
            await tbtcVault.getAddress(),
            await acreBTC.getAddress(),
            await tbtcBridge.getAddress(),
          ],
          {
            kind: "transparent",
          },
        ),
      ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
    })

    it("should revert if tbtcVault address is zero", async () => {
      const WithdrawalQueueFactory =
        await ethers.getContractFactory("WithdrawalQueue")
      await expect(
        upgrades.deployProxy(
          WithdrawalQueueFactory,
          [
            await tbtc.getAddress(),
            await midasVault.getAddress(),
            await midasAllocator.getAddress(),
            ethers.ZeroAddress,
            await acreBTC.getAddress(),
            await tbtcBridge.getAddress(),
          ],
          {
            kind: "transparent",
          },
        ),
      ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
    })

    it("should revert if acreBTC address is zero", async () => {
      const WithdrawalQueueFactory =
        await ethers.getContractFactory("WithdrawalQueue")
      await expect(
        upgrades.deployProxy(
          WithdrawalQueueFactory,
          [
            await tbtc.getAddress(),
            await midasVault.getAddress(),
            await midasAllocator.getAddress(),
            await tbtcVault.getAddress(),
            await tbtcBridge.getAddress(),
            ethers.ZeroAddress,
          ],
          {
            kind: "transparent",
          },
        ),
      ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
    })
  })

  describe("requestRedeem", () => {
    beforeAfterSnapshotWrapper()

    const redeemedShares = to1e18(5)

    context("when user has sufficient acreBTC balance", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup: Give depositor generous amount of tBTC and let them deposit to get acreBTC
        const generousAmount = to1e18(100) // Much larger amount
        await tbtc.mint(depositor.address, generousAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), generousAmount)
        await acreBTC
          .connect(depositor)
          .deposit(generousAmount, depositor.address)

        // Allocate funds to Midas to have shares available
        await midasAllocator.connect(maintainer).allocate()
      })

      context("with no exit fee", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        let redeemedAssets: bigint
        let redeemedMidasShares: bigint

        before(async () => {
          await acreBTC.connect(governance).updateExitFeeBasisPoints(0)

          redeemedAssets = await acreBTC.convertToAssets(redeemedShares)
          redeemedMidasShares = await midasVault.convertToShares(redeemedAssets)

          await acreBTC.connect(depositor).approve(depositor, redeemedShares)

          tx = await acreBTC
            .connect(depositor)
            .requestRedeem(redeemedShares, depositor.address, depositor.address)
        })

        it("should remove midas shares from Midas Allocator", async () => {
          await expect(tx).to.changeTokenBalance(
            midasVaultSharesToken,
            await midasAllocator.getAddress(),
            -redeemedMidasShares,
          )
        })

        it("should burn acreBTC from depositor", async () => {
          await expect(tx).to.changeTokenBalance(
            acreBTC,
            depositor.address,
            -redeemedShares,
          )
        })

        it("should not emit RedeemFeeRequested event", async () => {
          await expect(tx).to.not.emit(withdrawalQueue, "RedeemFeeRequested")
        })

        it("should emit RedeemRequested event", async () => {
          await expect(tx)
            .to.emit(withdrawalQueue, "RedeemRequested")
            .withArgs(
              1,
              depositor.address,
              101,
              redeemedAssets,
              redeemedMidasShares,
            )
        })

        it("should call Midas Vault to redeem shares", async () => {
          await expect(tx)
            .to.emit(midasVault, "MidasVaultRedeemRequested")
            .withArgs(redeemedMidasShares, depositor.address)
        })

        it("should increment request counter", async () => {
          expect(await withdrawalQueue.count()).to.equal(1n)
        })
      })

      context("with exit fee", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        let redeemedAssets: bigint
        let redeemedMidasShares: bigint

        let exitFee: bigint
        let exitFeeInMidasShares: bigint

        before(async () => {
          // Set 1% exit fee
          await acreBTC
            .connect(governance)
            .updateExitFeeBasisPoints(exitFeeBasisPoints)

          exitFee = feeOnTotal(
            await acreBTC.convertToAssets(redeemedShares),
            exitFeeBasisPoints,
          )
          exitFeeInMidasShares = await midasVault.convertToShares(exitFee)

          redeemedAssets =
            (await acreBTC.convertToAssets(redeemedShares)) - exitFee
          redeemedMidasShares = await midasVault.convertToShares(redeemedAssets)

          await acreBTC.connect(depositor).approve(depositor, redeemedShares)

          tx = await acreBTC
            .connect(depositor)
            .requestRedeem(redeemedShares, depositor.address, depositor.address)
        })

        it("should remove midas shares from Midas Allocator", async () => {
          await expect(tx).to.changeTokenBalance(
            midasVaultSharesToken,
            await midasAllocator.getAddress(),
            -(redeemedMidasShares + exitFeeInMidasShares),
          )
        })

        it("should burn acreBTC from depositor", async () => {
          await expect(tx).to.changeTokenBalance(
            acreBTC,
            depositor.address,
            -redeemedShares,
          )
        })

        it("should emit RedeemFeeRequested event", async () => {
          await expect(tx)
            .to.emit(withdrawalQueue, "RedeemFeeRequested")
            .withArgs(1, 101, exitFee, exitFeeInMidasShares)
        })

        it("should emit RedeemRequested event", async () => {
          await expect(tx)
            .to.emit(withdrawalQueue, "RedeemRequested")
            .withArgs(
              1,
              depositor.address,
              102,
              redeemedAssets,
              redeemedMidasShares,
            )
        })

        it("should call Midas Vault to redeem fee shares", async () => {
          await expect(tx)
            .to.emit(midasVault, "MidasVaultRedeemRequested")
            .withArgs(exitFeeInMidasShares, treasury.address)
        })

        it("should call Midas Vault to redeem shares", async () => {
          await expect(tx)
            .to.emit(midasVault, "MidasVaultRedeemRequested")
            .withArgs(redeemedMidasShares, depositor.address)
        })

        it("should increment request counter", async () => {
          expect(await withdrawalQueue.count()).to.equal(1n)
        })
      })
    })
  })

  describe("requestRedeemAndBridge", () => {
    beforeAfterSnapshotWrapper()

    const redeemerOutputScript =
      "0x1600143A40F641492A28AC72C7098A9D6AA083E5E62F66" // bytes

    context("when user has sufficient acreBTC balance", () => {
      beforeAfterSnapshotWrapper()

      const expectedRequestId = 1n

      before(async () => {
        // Setup: Give depositor generous amount of tBTC and let them deposit to get acreBTC
        const generousAmount = to1e18(100) // Much larger amount
        await tbtc.mint(depositor.address, generousAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), generousAmount)
        await acreBTC
          .connect(depositor)
          .deposit(generousAmount, depositor.address)

        // Allocate funds to Midas to have shares available
        await midasAllocator.connect(maintainer).allocate()

        // Set 1% exit fee
        await acreBTC
          .connect(governance)
          .updateExitFeeBasisPoints(exitFeeBasisPoints)
      })

      describe("test redemption request", () => {
        beforeAfterSnapshotWrapper()

        const redeemedShares = to1e18(5)

        let tx: ContractTransactionResponse

        let redeemedAssets: bigint
        let redeemedMidasShares: bigint

        let exitFee: bigint
        let exitFeeInMidasShares: bigint

        before(async () => {
          exitFee = feeOnTotal(
            await acreBTC.convertToAssets(redeemedShares),
            exitFeeBasisPoints,
          )
          exitFeeInMidasShares = await midasVault.convertToShares(exitFee)

          redeemedAssets =
            (await acreBTC.convertToAssets(redeemedShares)) - exitFee
          redeemedMidasShares = await midasVault.convertToShares(redeemedAssets)

          // Request redemption and bridge
          tx = await acreBTC
            .connect(depositor)
            .requestRedeemAndBridge(
              redeemedShares,
              depositor.address,
              redeemerOutputScript,
            )
        })

        it("should remove midas shares from Midas Allocator", async () => {
          await expect(tx).to.changeTokenBalance(
            midasVaultSharesToken,
            await midasAllocator.getAddress(),
            -(redeemedMidasShares + exitFeeInMidasShares),
          )
        })

        it("should burn acreBTC from depositor", async () => {
          await expect(tx).to.changeTokenBalance(
            acreBTC,
            depositor.address,
            -redeemedShares,
          )
        })

        it("should call Midas Vault to redeem shares", async () => {
          await expect(tx)
            .to.emit(midasVault, "MidasVaultRedeemRequested")
            .withArgs(
              redeemedMidasShares + exitFeeInMidasShares,
              await withdrawalQueue.getAddress(),
            )
        })

        it("should register redeem and bridge request", async () => {
          const storedRequest =
            await withdrawalQueue.redemAndBridgeRequests(expectedRequestId)

          expect(storedRequest.redeemer).to.equal(depositor.address)
          expect(storedRequest.tbtcAmount).to.equal(redeemedAssets)
          expect(storedRequest.exitFeeInTbtc).to.equal(exitFee)
          expect(storedRequest.completedAt).to.equal(0n)
          expect(storedRequest.redeemerOutputScriptHash).to.equal(
            ethers.keccak256(redeemerOutputScript),
          )
        })

        it("should emit RedeemAndBridgeRequested event", async () => {
          await expect(tx)
            .to.emit(withdrawalQueue, "RedeemAndBridgeRequested")
            .withArgs(
              expectedRequestId,
              depositor.address,
              101,
              redeemedAssets,
              exitFee,
              redeemedMidasShares + exitFeeInMidasShares,
            )
        })

        it("should increment request counter", async () => {
          expect(await withdrawalQueue.count()).to.equal(1n)
        })
      })

      describe("test minimum redemption amount for bridging to Bitcoin", () => {
        beforeAfterSnapshotWrapper()

        // The value matches the one configured in BridgeStub contract, but converted
        // to 1e18 precision.
        const minimumBridgeRedemptionTbtcAmount = to1e18(0.009) // 0.009 tBTC

        const exitFee = feeOnRaw(
          minimumBridgeRedemptionTbtcAmount,
          exitFeeBasisPoints,
        )

        const minimumBridgeRedemptionTbtcAmountWithFee =
          minimumBridgeRedemptionTbtcAmount + exitFee

        context(
          "when redemption amount is less than the minimum redemption amount for bridging to Bitcoin",
          () => {
            beforeAfterSnapshotWrapper()

            it("should revert", async () => {
              const shares = await acreBTC.convertToAssets(
                minimumBridgeRedemptionTbtcAmountWithFee - 1n,
              )

              await expect(
                acreBTC
                  .connect(depositor)
                  .requestRedeemAndBridge(
                    shares,
                    depositor.address,
                    redeemerOutputScript,
                  ),
              )
                .to.be.revertedWithCustomError(
                  withdrawalQueue,
                  "RedemptionAmountTooSmall",
                )
                .withArgs(
                  minimumBridgeRedemptionTbtcAmount - 1n,
                  minimumBridgeRedemptionTbtcAmount,
                )
            })
          },
        )

        context(
          "when redemption amount is greater than the minimum redemption amount for bridging to Bitcoin",
          () => {
            beforeAfterSnapshotWrapper()

            it("should not revert", async () => {
              const shares = await acreBTC.convertToAssets(
                minimumBridgeRedemptionTbtcAmountWithFee,
              )

              const redeemedMidasShares = await midasVault.convertToShares(
                minimumBridgeRedemptionTbtcAmountWithFee,
              )

              const tx = await acreBTC
                .connect(depositor)
                .requestRedeemAndBridge(
                  shares,
                  depositor.address,
                  redeemerOutputScript,
                )

              await expect(tx)
                .to.emit(withdrawalQueue, "RedeemAndBridgeRequested")
                .withArgs(
                  expectedRequestId,
                  depositor.address,
                  101,
                  minimumBridgeRedemptionTbtcAmount,
                  exitFee,
                  redeemedMidasShares,
                )
            })
          },
        )
      })
    })

    context("when user has insufficient acreBTC balance", () => {
      it("should revert", async () => {
        const largeAmount = to1e18(1000)
        await expect(
          acreBTC
            .connect(depositor)
            .requestRedeemAndBridge(
              largeAmount,
              depositor.address,
              redeemerOutputScript,
            ),
        ).to.be.reverted // ERC20 transfer will fail
      })
    })
  })

  describe("finalizeRedeemAndBridge", () => {
    beforeAfterSnapshotWrapper()

    const redeemerOutputScript =
      "0x1600143A40F641492A28AC72C7098A9D6AA083E5E62F66" // bytes
    const depositAmount = to1e18(10)
    const redeemedShares = to1e18(5)

    const expectedRequestId = 1n

    let redemptionData: string

    let redeemedAssets: bigint
    let exitFee: bigint

    before(async () => {
      redemptionData = createRedemptionData(
        depositor.address,
        redeemerOutputScript,
      )

      await tbtc.mint(depositor.address, depositAmount)
      await tbtc
        .connect(depositor)
        .approve(await acreBTC.getAddress(), depositAmount)
      await acreBTC.connect(depositor).deposit(depositAmount, depositor.address)

      await midasAllocator.connect(maintainer).allocate()

      await acreBTC
        .connect(governance)
        .updateExitFeeBasisPoints(exitFeeBasisPoints)

      exitFee = feeOnTotal(
        await acreBTC.convertToAssets(redeemedShares),
        exitFeeBasisPoints,
      )

      redeemedAssets = (await acreBTC.convertToAssets(redeemedShares)) - exitFee
    })

    context("when caller is not maintainer", () => {
      beforeAfterSnapshotWrapper()

      it("should revert", async () => {
        await expect(
          withdrawalQueue
            .connect(thirdParty)
            .finalizeRedeemAndBridge(expectedRequestId, redemptionData),
        ).to.be.revertedWithCustomError(withdrawalQueue, "CallerNotMaintainer")
      })
    })

    context("when redeem and bridge request is not found", () => {
      beforeAfterSnapshotWrapper()

      it("should revert", async () => {
        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(100, redemptionData),
        ).to.be.revertedWithCustomError(
          withdrawalQueue,
          "WithdrawalRequestNotFound",
        )
      })
    })

    context("when redeem and bridge request is registered", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await acreBTC
          .connect(depositor)
          .requestRedeemAndBridge(
            redeemedShares,
            depositor.address,
            redeemerOutputScript,
          )

        // Give withdrawal queue some tBTC to simulate Midas Vault redemption completed.
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          redeemedAssets + exitFee,
        )
      })

      context("when tBTC token owner is not tbtcVault", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          // Set tBTC owner to something other than tbtcVault
          await tbtc.setOwner(thirdParty.address)

          await expect(
            withdrawalQueue
              .connect(maintainer)
              .finalizeRedeemAndBridge(expectedRequestId, redemptionData),
          ).to.be.revertedWithCustomError(
            withdrawalQueue,
            "UnexpectedTbtcTokenOwner",
          )
        })
      })

      context("when redeem and bridge request is already completed", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          // Give withdrawal queue some tBTC to simulate Midas Vault redemption completed.
          await tbtc.mint(
            await withdrawalQueue.getAddress(),
            redeemedAssets + exitFee,
          )

          // Complete the request
          await withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(expectedRequestId, redemptionData)
        })

        it("should revert", async () => {
          await expect(
            withdrawalQueue
              .connect(maintainer)
              .finalizeRedeemAndBridge(expectedRequestId, redemptionData),
          ).to.be.revertedWithCustomError(
            withdrawalQueue,
            "WithdrawalRequestAlreadyCompleted",
          )
        })
      })

      context("when redeem and bridge request is not completed", () => {
        beforeAfterSnapshotWrapper()

        describe("when request is successful", () => {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await withdrawalQueue
              .connect(maintainer)
              .finalizeRedeemAndBridge(expectedRequestId, redemptionData)
          })

          it("should mark request as completed", async () => {
            expect(
              (await withdrawalQueue.redemAndBridgeRequests(expectedRequestId))
                .completedAt,
            ).to.be.greaterThan(0n)
          })

          it("should emit RedeemCompletedAndBridgeRequested event", async () => {
            await expect(tx)
              .to.emit(withdrawalQueue, "RedeemCompletedAndBridgeRequested")
              .withArgs(expectedRequestId, depositor.address, redeemedAssets)
          })

          it("should transfer exit fee to treasury", async () => {
            await expect(tx).to.changeTokenBalances(
              tbtc,
              [treasury.address],
              [exitFee],
            )
          })

          it("should call approveAndCall in tBTC contract", async () => {
            await expect(tx)
              .to.emit(tbtc, "ApproveAndCallCalled")
              .withArgs(
                await tbtcVault.getAddress(),
                redeemedAssets,
                redemptionData,
              )
          })
        })

        describe("when redemption data is invalid", () => {
          beforeAfterSnapshotWrapper()

          it("should revert if redemption data has wrong redeemer", async () => {
            const wrongRedeemer = depositor2.address
            const wrongRedemptionData = createRedemptionData(
              wrongRedeemer,
              redeemerOutputScript,
            )

            await expect(
              withdrawalQueue
                .connect(maintainer)
                .finalizeRedeemAndBridge(
                  expectedRequestId,
                  wrongRedemptionData,
                ),
            )
              .to.be.revertedWithCustomError(
                withdrawalQueue,
                "InvalidRedemptionData",
              )
              .withArgs(
                wrongRedeemer,
                depositor.address,
                ethers.keccak256(redeemerOutputScript),
                ethers.keccak256(redeemerOutputScript),
              )
          })

          it("should revert if redemption data has wrong redeemer output script hash", async () => {
            const wrongRedeemerOutputScript = "0x5678"
            const wrongRedemptionData = createRedemptionData(
              depositor.address,
              wrongRedeemerOutputScript,
            )

            await expect(
              withdrawalQueue
                .connect(maintainer)
                .finalizeRedeemAndBridge(
                  expectedRequestId,
                  wrongRedemptionData,
                ),
            )
              .to.be.revertedWithCustomError(
                withdrawalQueue,
                "InvalidRedemptionData",
              )
              .withArgs(
                depositor.address,
                depositor.address,
                ethers.keccak256(wrongRedeemerOutputScript),
                ethers.keccak256(redeemerOutputScript),
              )
          })
        })

        describe("when approveAndCall fails", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            await tbtc.setApproveAndCallResult(false)

            await expect(
              withdrawalQueue
                .connect(maintainer)
                .finalizeRedeemAndBridge(expectedRequestId, redemptionData),
            ).to.be.revertedWithCustomError(
              withdrawalQueue,
              "ApproveAndCallFailed",
            )
          })
        })
      })
    })
  })

  describe("edge cases and integration", () => {
    beforeAfterSnapshotWrapper()

    const redeemerOutputScript1 = "0x1234"
    const redeemerOutputScript2 = "0x5678"
    const depositAmount = to1e18(10)

    describe("multiple bridge requests from same user", () => {
      beforeAfterSnapshotWrapper()

      it("should handle multiple bridge requests from same user", async () => {
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        const amount1 = to1e18(2)
        const amount2 = to1e18(3)

        await acreBTC
          .connect(depositor)
          .requestRedeemAndBridge(
            amount1,
            depositor.address,
            redeemerOutputScript1,
          )

        await acreBTC
          .connect(depositor)
          .requestRedeemAndBridge(
            amount2,
            depositor.address,
            redeemerOutputScript2,
          )

        expect(await withdrawalQueue.count()).to.equal(2n)

        const request1 = await withdrawalQueue.redemAndBridgeRequests(1)
        const request2 = await withdrawalQueue.redemAndBridgeRequests(2)

        expect(request1.redeemer).to.equal(depositor.address)
        expect(request1.tbtcAmount).to.be.equal(amount1)
        expect(request1.redeemerOutputScriptHash).to.equal(
          ethers.keccak256(redeemerOutputScript1),
        )

        expect(request2.redeemer).to.equal(depositor.address)
        expect(request2.tbtcAmount).to.be.equal(amount2)
        expect(request2.redeemerOutputScriptHash).to.equal(
          ethers.keccak256(redeemerOutputScript2),
        )
      })
    })

    describe("mixed direct and bridge redemptions", () => {
      beforeAfterSnapshotWrapper()

      it("should handle mixed direct and bridge redemptions", async () => {
        // Use fresh depositor with more generous balance for this test
        const testDepositAmount = to1e18(100) // Much larger amount to ensure sufficient balance
        await tbtc.mint(depositor.address, testDepositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(testDepositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        // Ensure the vault has sufficient tBTC for direct redemption
        const amount1 = to1e18(2)
        const amount2 = to1e18(3)

        // Direct redemption
        await acreBTC
          .connect(depositor)
          .requestRedeem(amount1, depositor.address, depositor.address)

        expect(await withdrawalQueue.count()).to.equal(1)

        // Bridge redemption - should increment counter
        await acreBTC
          .connect(depositor)
          .requestRedeemAndBridge(
            amount2,
            depositor.address,
            redeemerOutputScript2,
          )

        expect(await withdrawalQueue.count()).to.equal(2)

        // Check direct request not being stored
        const request1 = await withdrawalQueue.redemAndBridgeRequests(1)
        expect(request1.redeemer).to.equal(ethers.ZeroAddress)
        expect(request1.tbtcAmount).to.equal(0)

        // Check bridge request being stored
        const request = await withdrawalQueue.redemAndBridgeRequests(2)
        expect(request.redeemer).to.equal(depositor.address)
        expect(request.tbtcAmount).to.be.equal(amount2)
        expect(request.redeemerOutputScriptHash).to.equal(
          ethers.keccak256(redeemerOutputScript2),
        )
      })
    })

    describe("bridge requests from multiple users", () => {
      beforeAfterSnapshotWrapper()

      it("should handle bridge requests from multiple users", async () => {
        // Use larger deposits to ensure sufficient balance for both users
        const testDepositAmount = to1e18(20) // Much larger amount to ensure sufficient balance

        // Setup for depositor
        await tbtc.mint(depositor.address, testDepositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(testDepositAmount, depositor.address)

        // Setup for depositor2
        await tbtc.mint(depositor2.address, testDepositAmount)
        await tbtc
          .connect(depositor2)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(depositor2)
          .deposit(testDepositAmount, depositor2.address)

        await midasAllocator.connect(maintainer).allocate()

        const amount = to1e18(3)
        const outputScript1 = "0x1111"
        const outputScript2 = "0x2222"

        await acreBTC
          .connect(depositor)
          .requestRedeemAndBridge(amount, depositor.address, outputScript1)

        await acreBTC
          .connect(depositor2)
          .requestRedeemAndBridge(amount, depositor2.address, outputScript2)

        expect(await withdrawalQueue.count()).to.equal(2)

        const request1 = await withdrawalQueue.redemAndBridgeRequests(1)
        const request2 = await withdrawalQueue.redemAndBridgeRequests(2)

        expect(request1.redeemer).to.equal(depositor.address)
        expect(request1.redeemerOutputScriptHash).to.equal(
          ethers.keccak256(outputScript1),
        )

        expect(request2.redeemer).to.equal(depositor2.address)
        expect(request2.redeemerOutputScriptHash).to.equal(
          ethers.keccak256(outputScript2),
        )
      })
    })

    describe("check conversion rates updates", () => {
      beforeAfterSnapshotWrapper()

      // TODO: This test should be ported to the mainnet integration tests suite
      // and validated with the mainnet setup and the Midas Vault.
      it("should update conversion rates", async () => {
        // Set fees to 0 for simpler testing
        await acreBTC.connect(governance).updateEntryFeeBasisPoints(0)
        await acreBTC.connect(governance).updateExitFeeBasisPoints(0)

        // Deposit from Depositor 1: 40 tBTC
        const depositAmount1 = to1e18(40)
        const receivedShares1 = depositAmount1
        await tbtc.mint(depositor.address, depositAmount1)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount1)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount1, depositor.address)

        // Deposit from Depositor 2: 60 tBTC
        const depositAmount2 = to1e18(60)
        const receivedShares2 = depositAmount2
        await tbtc.mint(depositor2.address, depositAmount2)
        await tbtc
          .connect(depositor2)
          .approve(await acreBTC.getAddress(), depositAmount2)
        await acreBTC
          .connect(depositor2)
          .deposit(depositAmount2, depositor2.address)

        await midasAllocator.connect(maintainer).allocate()

        // Check initial conversion rates
        expect(await acreBTC.totalSupply()).to.be.equal(
          receivedShares1 + receivedShares2,
        )
        expect(await acreBTC.totalAssets()).to.be.equal(
          depositAmount1 + depositAmount2,
        )
        expect(await acreBTC.convertToAssets(receivedShares1)).to.be.equal(
          depositAmount1,
        )
        expect(await acreBTC.convertToAssets(receivedShares2)).to.be.equal(
          depositAmount2,
        )

        // Yield 10 tBTC to acreBTC
        const yieldAmount = to1e18(50)
        const yieldDepositor1 = to1e18(20) // 40% of yield
        const yieldDepositor2 = to1e18(30) // 60% of yield
        await tbtc.mint(await acreBTC.getAddress(), yieldAmount)

        // Check conversion rates after yield
        expect(await acreBTC.totalSupply()).to.be.closeTo(
          receivedShares1 + receivedShares2,
          1n,
        )
        expect(await acreBTC.totalAssets()).to.be.closeTo(
          depositAmount1 + depositAmount2 + yieldAmount,
          1n,
        )
        expect(await acreBTC.convertToAssets(receivedShares1)).to.be.closeTo(
          depositAmount1 + yieldDepositor1,
          1n,
        )
        expect(await acreBTC.convertToAssets(receivedShares2)).to.be.closeTo(
          depositAmount2 + yieldDepositor2,
          1n,
        )

        // Request redeem from Depositor 1
        const redeemShares1 = to1e18(10) // 1/4 of depositor 1's shares
        const redeemAmount1 = to1e18(15) // 1/4 * (40 + 20) = 15

        await acreBTC
          .connect(depositor)
          .requestRedeem(redeemShares1, depositor.address, depositor.address)

        // Check conversion rates after redeem from Depositor 1
        expect(await acreBTC.totalSupply()).to.be.closeTo(
          receivedShares1 + receivedShares2 - redeemShares1,
          1n,
        )
        expect(await acreBTC.totalAssets()).to.be.closeTo(
          depositAmount1 + depositAmount2 + yieldAmount - redeemAmount1,
          1n,
        )

        // Request redeem and bridge from Depositor 2
        const redeemShares2 = to1e18(15) // 1/4 of depositor 2's shares
        const redeemAmount2 = to1e18("22.5") // 1/4 * (60 + 30) = 22.5

        await acreBTC
          .connect(depositor2)
          .requestRedeemAndBridge(
            redeemShares2,
            depositor2.address,
            redeemerOutputScript2,
          )

        // Check conversion rates after redeem and bridge from Depositor 2
        expect(await acreBTC.totalSupply()).to.be.closeTo(
          receivedShares1 + receivedShares2 - redeemShares1 - redeemShares2,
          1n,
        )
        expect(await acreBTC.totalAssets()).to.be.closeTo(
          depositAmount1 +
            depositAmount2 +
            yieldAmount -
            redeemAmount1 -
            redeemAmount2,
          1n,
        )
      })
    })
  })
})
