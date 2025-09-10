/* eslint-disable func-names */
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"

import { ethers, helpers } from "hardhat"
import { expect } from "chai"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractTransactionResponse, MaxUint256, ZeroAddress } from "ethers"

import DepositState from "../types/depositState"

import type {
  AcreBTC as acreBTC,
  BridgeStub,
  TBTCVaultStub,
  BitcoinDepositorV2,
  TestERC20,
  FeesReimbursementPool,
} from "../typechain"
import { deployment } from "./helpers"
import { beforeAfterSnapshotWrapper } from "./helpers/snapshot"
import { tbtcDepositData } from "./data/tbtc"
import { to1ePrecision } from "./utils"

async function fixture() {
  const {
    bitcoinDepositorV2,
    feesReimbursementPool,
    tbtcBridge,
    tbtcVault,
    acreBtc,
    tbtc,
  } = await deployment()

  return {
    bitcoinDepositor: bitcoinDepositorV2,
    feesReimbursementPool,
    tbtcBridge,
    tbtcVault,
    acreBtc,
    tbtc,
  }
}

const { lastBlockTime } = helpers.time
const { getNamedSigners, getUnnamedSigners } = helpers.signers

describe("BitcoinDepositorV2", () => {
  const defaultDepositDustThreshold = 1000000 // 1000000 satoshi = 0.01 BTC
  const defaultDepositTreasuryFeeDivisor = 2000 // 1/2000 = 0.05% = 0.0005
  const defaultDepositTxMaxFee = 1000 // 1000 satoshi = 0.00001 BTC
  const defaultOptimisticFeeDivisor = 500 // 1/500 = 0.002 = 0.2%
  const defaultDepositorFeeDivisor = 1000 // 1/1000 = 0.001 = 0.1%

  // Funding transaction amount: 10000 satoshi
  // tBTC Deposit Treasury Fee: 0.05% = 10000 * 0.05% = 5 satoshi
  // tBTC Optimistic Minting Fee: 0.2% = (10000 - 5) * 0.2% = 19,99 satoshi
  // tBTC Deposit Transaction Max Fee: 1000 satoshi
  // Depositor Fee: 1.25% = 10000 satoshi * 0.01% = 10 satoshi
  // Amounts below are calculated in 1e18 precision:
  const initialDepositAmount = to1ePrecision(10000, 10) // 10000 satoshi
  const bridgedTbtcAmount = to1ePrecision(897501, 8) // 8975,01 satoshi
  const bridgeFees = to1ePrecision(102499, 8) // 1024.99 satoshi
  const depositorFee = to1ePrecision(10, 10) // 10 satoshi
  const amountToDeposit = to1ePrecision(896501, 8) // 8965,01 satoshi

  let bitcoinDepositor: BitcoinDepositorV2
  let feesReimbursementPool: FeesReimbursementPool
  let tbtcBridge: BridgeStub
  let tbtcVault: TBTCVaultStub
  let acreBtc: acreBTC
  let tbtc: TestERC20

  let governance: HardhatEthersSigner
  let treasury: HardhatEthersSigner
  let thirdParty: HardhatEthersSigner

  before(async () => {
    ;({
      bitcoinDepositor,
      feesReimbursementPool,
      tbtcBridge,
      tbtcVault,
      acreBtc,
      tbtc,
    } = await loadFixture(fixture))
    ;({ governance, treasury } = await getNamedSigners())
    ;[thirdParty] = await getUnnamedSigners()

    await acreBtc.connect(governance).updateMinimumDepositAmount(
      10000000000000, // 0.00001
    )

    tbtcDepositData.reveal.vault = await tbtcVault.getAddress()

    await tbtcBridge
      .connect(governance)
      .setDepositDustThreshold(defaultDepositDustThreshold)
    await tbtcBridge
      .connect(governance)
      .setDepositTreasuryFeeDivisor(defaultDepositTreasuryFeeDivisor)
    await tbtcBridge
      .connect(governance)
      .setDepositTxMaxFee(defaultDepositTxMaxFee)
    await tbtcVault
      .connect(governance)
      .setOptimisticMintingFeeDivisor(defaultOptimisticFeeDivisor)
    await bitcoinDepositor
      .connect(governance)
      .updateDepositorFeeDivisor(defaultDepositorFeeDivisor)

    await tbtc.mint(await feesReimbursementPool.getAddress(), bridgeFees)
  })

  describe("initializeDeposit", () => {
    beforeAfterSnapshotWrapper()

    describe("when depositOwner is zero address", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor.initializeDeposit(
            tbtcDepositData.fundingTxInfo,
            tbtcDepositData.reveal,
            ZeroAddress,
            0,
          ),
        ).to.be.revertedWithCustomError(
          bitcoinDepositor,
          "DepositOwnerIsZeroAddress",
        )
      })
    })

    describe("when depositOwner is non zero address", () => {
      describe("when deposit is not in progress", () => {
        describe("when tbtc vault address is incorrect", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            const invalidTbtcVault =
              await ethers.Wallet.createRandom().getAddress()

            await expect(
              bitcoinDepositor
                .connect(thirdParty)
                .initializeDeposit(
                  tbtcDepositData.fundingTxInfo,
                  { ...tbtcDepositData.reveal, vault: invalidTbtcVault },
                  tbtcDepositData.depositOwner,
                  tbtcDepositData.referral,
                ),
            ).to.be.revertedWith("Vault address mismatch")
          })
        })

        describe("when tbtc vault address is correct", () => {
          describe("when referral is non-zero", () => {
            beforeAfterSnapshotWrapper()

            let tx: ContractTransactionResponse

            before(async () => {
              tx = await bitcoinDepositor
                .connect(thirdParty)
                .initializeDeposit(
                  tbtcDepositData.fundingTxInfo,
                  tbtcDepositData.reveal,
                  tbtcDepositData.depositOwner,
                  tbtcDepositData.referral,
                )
            })

            it("should emit DepositInitialized event", async () => {
              await expect(tx)
                .to.emit(bitcoinDepositor, "DepositInitialized")
                .withArgs(
                  tbtcDepositData.depositKey,
                  thirdParty.address,
                  tbtcDepositData.depositOwner,
                  initialDepositAmount,
                )
            })

            it("should update deposit state", async () => {
              const deposit = await bitcoinDepositor.deposits(
                tbtcDepositData.depositKey,
              )

              expect(deposit).to.be.equal(DepositState.Initialized)
            })

            it("should reveal the deposit to the bridge contract with extra data", async () => {
              const storedRevealedDeposit = await tbtcBridge.deposits(
                tbtcDepositData.depositKey,
              )

              expect(
                storedRevealedDeposit.revealedAt,
                "invalid revealedAt",
              ).to.be.equal(await lastBlockTime())

              expect(
                storedRevealedDeposit.extraData,
                "invalid extraData",
              ).to.be.equal(tbtcDepositData.extraData)
            })
          })

          describe("when referral is zero", () => {
            beforeAfterSnapshotWrapper()

            it("should succeed", async () => {
              await expect(
                bitcoinDepositor
                  .connect(thirdParty)
                  .initializeDeposit(
                    tbtcDepositData.fundingTxInfo,
                    tbtcDepositData.reveal,
                    tbtcDepositData.depositOwner,
                    0,
                  ),
              ).to.be.not.reverted
            })
          })
        })
      })

      describe("when deposit is already in progress", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await initializeDeposit()
        })

        it("should revert", async () => {
          await expect(
            bitcoinDepositor
              .connect(thirdParty)
              .initializeDeposit(
                tbtcDepositData.fundingTxInfo,
                tbtcDepositData.reveal,
                tbtcDepositData.depositOwner,
                tbtcDepositData.referral,
              ),
          ).to.be.revertedWith("Deposit already revealed")
        })
      })

      describe("when deposit is already finalized", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await initializeDeposit()

          // Simulate deposit request finalization.
          await finalizeMinting(tbtcDepositData.depositKey)

          await bitcoinDepositor
            .connect(thirdParty)
            .finalizeDeposit(tbtcDepositData.depositKey)
        })

        it("should revert", async () => {
          await expect(
            bitcoinDepositor
              .connect(thirdParty)
              .initializeDeposit(
                tbtcDepositData.fundingTxInfo,
                tbtcDepositData.reveal,
                tbtcDepositData.depositOwner,
                tbtcDepositData.referral,
              ),
          ).to.be.revertedWith("Deposit already revealed")
        })
      })
    })
  })

  describe("finalizeDeposit", () => {
    beforeAfterSnapshotWrapper()

    describe("when deposit has not been initialized", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor
            .connect(thirdParty)
            .finalizeDeposit(tbtcDepositData.depositKey),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "UnexpectedDepositState",
          )
          .withArgs(DepositState.Unknown, DepositState.Initialized)
      })
    })

    describe("when deposit has been initialized", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await initializeDeposit()
      })

      describe("when deposit was not bridged", () => {
        it("should revert", async () => {
          await expect(
            bitcoinDepositor
              .connect(thirdParty)
              .finalizeDeposit(tbtcDepositData.depositKey),
          ).to.be.revertedWith("Deposit not finalized by the bridge")
        })
      })

      describe("when deposit was bridged", () => {
        describe("when deposit has not been finalized", () => {
          describe("when depositor contract balance is lower than bridged amount", () => {
            beforeAfterSnapshotWrapper()

            // The minted value should be less than calculated `bridgedTbtcAmount`.
            const mintedAmount = to1ePrecision(7455, 10) // 7455 satoshi

            before(async () => {
              // Simulate deposit request finalization.
              await finalizeMinting(tbtcDepositData.depositKey, mintedAmount)
            })

            it("should revert", async () => {
              await expect(
                bitcoinDepositor
                  .connect(thirdParty)
                  .finalizeDeposit(tbtcDepositData.depositKey),
              )
                .to.be.revertedWithCustomError(
                  acreBtc,
                  "ERC20InsufficientBalance",
                )
                .withArgs(
                  await bitcoinDepositor.getAddress(),
                  mintedAmount - depositorFee,
                  amountToDeposit,
                )
            })
          })

          describe("when depositor contract balance is higher than bridged amount", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
              // Simulate deposit request finalization.
              await finalizeMinting(tbtcDepositData.depositKey)
            })

            describe("when depositor fee divisor is not zero", () => {
              describe("when bridge fees reimbursement threshold is zero", () => {
                beforeAfterSnapshotWrapper()

                const expectedAssetsAmount = amountToDeposit
                const expectedReceivedSharesAmount = amountToDeposit

                let tx: ContractTransactionResponse

                before(async () => {
                  tx = await bitcoinDepositor
                    .connect(thirdParty)
                    .finalizeDeposit(tbtcDepositData.depositKey)
                })

                it("should transfer depositor fee", async () => {
                  await expect(tx).to.changeTokenBalances(
                    tbtc,
                    [treasury],
                    [depositorFee],
                  )
                })

                it("should update deposit state", async () => {
                  const depositState = await bitcoinDepositor.deposits(
                    tbtcDepositData.depositKey,
                  )

                  expect(depositState).to.be.equal(DepositState.Finalized)
                })

                it("should emit DepositFinalized event", async () => {
                  await expect(tx)
                    .to.emit(bitcoinDepositor, "DepositFinalized")
                    .withArgs(
                      tbtcDepositData.depositKey,
                      thirdParty.address,
                      tbtcDepositData.referral,
                      initialDepositAmount,
                      bridgedTbtcAmount,
                      depositorFee,
                    )
                })

                it("should emit Deposit event", async () => {
                  await expect(tx)
                    .to.emit(acreBtc, "Deposit")
                    .withArgs(
                      await bitcoinDepositor.getAddress(),
                      tbtcDepositData.depositOwner,
                      expectedAssetsAmount,
                      expectedReceivedSharesAmount,
                    )
                })

                it("should deposit in Acre contract", async () => {
                  await expect(
                    tx,
                    "invalid minted acreBTC amount",
                  ).to.changeTokenBalances(
                    acreBtc,
                    [tbtcDepositData.depositOwner],
                    [expectedReceivedSharesAmount],
                  )

                  await expect(
                    tx,
                    "invalid deposited tBTC amount",
                  ).to.changeTokenBalances(
                    tbtc,
                    [acreBtc],
                    [expectedAssetsAmount],
                  )
                })
              })

              describe("when bridge fees reimbursement threshold is not zero", () => {
                describe("when bridge fees reimbursement threshold is less than the deposit amount", () => {
                  beforeAfterSnapshotWrapper()

                  let tx: ContractTransactionResponse

                  before(async () => {
                    await bitcoinDepositor
                      .connect(governance)
                      .updateBridgeFeesReimbursementThreshold(
                        initialDepositAmount - 1n,
                      )

                    tx = await bitcoinDepositor
                      .connect(thirdParty)
                      .finalizeDeposit(tbtcDepositData.depositKey)
                  })

                  it("should not reimburse bridge fees", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [feesReimbursementPool, acreBtc],
                      [0, amountToDeposit],
                    )
                  })
                })

                describe("when bridge fees reimbursement threshold equals the deposit amount", () => {
                  beforeAfterSnapshotWrapper()

                  const expectedAssetsAmount = amountToDeposit + bridgeFees
                  const expectedReceivedSharesAmount = expectedAssetsAmount

                  let tx: ContractTransactionResponse

                  before(async () => {
                    await bitcoinDepositor
                      .connect(governance)
                      .updateBridgeFeesReimbursementThreshold(
                        initialDepositAmount,
                      )

                    tx = await bitcoinDepositor
                      .connect(thirdParty)
                      .finalizeDeposit(tbtcDepositData.depositKey)
                  })

                  it("should reimburse bridge fees", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [feesReimbursementPool, acreBtc],
                      [-bridgeFees, amountToDeposit + bridgeFees],
                    )
                  })

                  it("should transfer depositor fee", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [treasury],
                      [depositorFee],
                    )
                  })

                  it("should update deposit state", async () => {
                    const depositState = await bitcoinDepositor.deposits(
                      tbtcDepositData.depositKey,
                    )

                    expect(depositState).to.be.equal(DepositState.Finalized)
                  })

                  it("should emit DepositFinalized event", async () => {
                    await expect(tx)
                      .to.emit(bitcoinDepositor, "DepositFinalized")
                      .withArgs(
                        tbtcDepositData.depositKey,
                        thirdParty.address,
                        tbtcDepositData.referral,
                        initialDepositAmount,
                        bridgedTbtcAmount + bridgeFees,
                        depositorFee,
                      )
                  })

                  it("should emit Deposit event", async () => {
                    await expect(tx)
                      .to.emit(acreBtc, "Deposit")
                      .withArgs(
                        await bitcoinDepositor.getAddress(),
                        tbtcDepositData.depositOwner,
                        expectedAssetsAmount,
                        expectedReceivedSharesAmount,
                      )
                  })

                  it("should deposit in Acre contract", async () => {
                    await expect(
                      tx,
                      "invalid minted acreBTC amount",
                    ).to.changeTokenBalances(
                      acreBtc,
                      [tbtcDepositData.depositOwner],
                      [expectedReceivedSharesAmount],
                    )

                    await expect(
                      tx,
                      "invalid deposited tBTC amount",
                    ).to.changeTokenBalances(
                      tbtc,
                      [acreBtc],
                      [expectedAssetsAmount],
                    )
                  })
                })

                describe("when bridge fees reimbursement threshold is greater than the deposit amount", () => {
                  beforeAfterSnapshotWrapper()

                  const expectedAssetsAmount = amountToDeposit + bridgeFees
                  const expectedReceivedSharesAmount = expectedAssetsAmount

                  let tx: ContractTransactionResponse

                  before(async () => {
                    await bitcoinDepositor
                      .connect(governance)
                      .updateBridgeFeesReimbursementThreshold(
                        initialDepositAmount + 1n,
                      )

                    tx = await bitcoinDepositor
                      .connect(thirdParty)
                      .finalizeDeposit(tbtcDepositData.depositKey)
                  })

                  it("should reimburse bridge fees", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [feesReimbursementPool, acreBtc],
                      [-bridgeFees, amountToDeposit + bridgeFees],
                    )
                  })

                  it("should transfer depositor fee", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [treasury],
                      [depositorFee],
                    )
                  })

                  it("should update deposit state", async () => {
                    const depositState = await bitcoinDepositor.deposits(
                      tbtcDepositData.depositKey,
                    )

                    expect(depositState).to.be.equal(DepositState.Finalized)
                  })

                  it("should emit DepositFinalized event", async () => {
                    await expect(tx)
                      .to.emit(bitcoinDepositor, "DepositFinalized")
                      .withArgs(
                        tbtcDepositData.depositKey,
                        thirdParty.address,
                        tbtcDepositData.referral,
                        initialDepositAmount,
                        bridgedTbtcAmount + bridgeFees,
                        depositorFee,
                      )
                  })

                  it("should emit Deposit event", async () => {
                    await expect(tx)
                      .to.emit(acreBtc, "Deposit")
                      .withArgs(
                        await bitcoinDepositor.getAddress(),
                        tbtcDepositData.depositOwner,
                        expectedAssetsAmount,
                        expectedReceivedSharesAmount,
                      )
                  })

                  it("should deposit in Acre contract", async () => {
                    await expect(
                      tx,
                      "invalid minted acreBTC amount",
                    ).to.changeTokenBalances(
                      acreBtc,
                      [tbtcDepositData.depositOwner],
                      [expectedReceivedSharesAmount],
                    )

                    await expect(
                      tx,
                      "invalid deposited tBTC amount",
                    ).to.changeTokenBalances(
                      tbtc,
                      [acreBtc],
                      [expectedAssetsAmount],
                    )
                  })
                })

                describe("when fees reimbursement pool balance is less than bridge fees", () => {
                  beforeAfterSnapshotWrapper()

                  const availableReimbursementAmount = bridgeFees - 10n
                  const expectedAssetsAmount =
                    amountToDeposit + availableReimbursementAmount
                  const expectedReceivedSharesAmount = expectedAssetsAmount

                  let tx: ContractTransactionResponse

                  before(async () => {
                    await bitcoinDepositor
                      .connect(governance)
                      .updateBridgeFeesReimbursementThreshold(
                        initialDepositAmount + 1n,
                      )

                    await feesReimbursementPool
                      .connect(governance)
                      .withdraw(thirdParty.address, bridgeFees)

                    await tbtc.mint(
                      await feesReimbursementPool.getAddress(),
                      availableReimbursementAmount,
                    )

                    tx = await bitcoinDepositor
                      .connect(thirdParty)
                      .finalizeDeposit(tbtcDepositData.depositKey)
                  })

                  it("should reimburse bridge fees", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [feesReimbursementPool, acreBtc],
                      [
                        -availableReimbursementAmount,
                        amountToDeposit + availableReimbursementAmount,
                      ],
                    )
                  })

                  it("should transfer depositor fee", async () => {
                    await expect(tx).to.changeTokenBalances(
                      tbtc,
                      [treasury],
                      [depositorFee],
                    )
                  })

                  it("should update deposit state", async () => {
                    const depositState = await bitcoinDepositor.deposits(
                      tbtcDepositData.depositKey,
                    )

                    expect(depositState).to.be.equal(DepositState.Finalized)
                  })

                  it("should emit DepositFinalized event", async () => {
                    await expect(tx)
                      .to.emit(bitcoinDepositor, "DepositFinalized")
                      .withArgs(
                        tbtcDepositData.depositKey,
                        thirdParty.address,
                        tbtcDepositData.referral,
                        initialDepositAmount,
                        bridgedTbtcAmount + availableReimbursementAmount,
                        depositorFee,
                      )
                  })

                  it("should emit Deposit event", async () => {
                    await expect(tx)
                      .to.emit(acreBtc, "Deposit")
                      .withArgs(
                        await bitcoinDepositor.getAddress(),
                        tbtcDepositData.depositOwner,
                        expectedAssetsAmount,
                        expectedReceivedSharesAmount,
                      )
                  })

                  it("should deposit in Acre contract", async () => {
                    await expect(
                      tx,
                      "invalid minted acreBTC amount",
                    ).to.changeTokenBalances(
                      acreBtc,
                      [tbtcDepositData.depositOwner],
                      [expectedReceivedSharesAmount],
                    )

                    await expect(
                      tx,
                      "invalid deposited tBTC amount",
                    ).to.changeTokenBalances(
                      tbtc,
                      [acreBtc],
                      [expectedAssetsAmount],
                    )
                  })
                })
              })
            })

            describe("when depositor fee divisor is zero", () => {
              beforeAfterSnapshotWrapper()

              const expectedAssetsAmount = amountToDeposit + depositorFee
              const expectedReceivedSharesAmount =
                amountToDeposit + depositorFee

              let tx: ContractTransactionResponse

              before(async () => {
                await bitcoinDepositor
                  .connect(governance)
                  .updateDepositorFeeDivisor(0)

                tx = await bitcoinDepositor
                  .connect(thirdParty)
                  .finalizeDeposit(tbtcDepositData.depositKey)
              })

              it("should not transfer depositor fee", async () => {
                await expect(tx).to.changeTokenBalances(tbtc, [treasury], [0])
              })

              it("should update deposit state", async () => {
                const deposit = await bitcoinDepositor.deposits(
                  tbtcDepositData.depositKey,
                )

                expect(deposit).to.be.equal(DepositState.Finalized)
              })

              it("should emit DepositFinalized event", async () => {
                await expect(tx)
                  .to.emit(bitcoinDepositor, "DepositFinalized")
                  .withArgs(
                    tbtcDepositData.depositKey,
                    thirdParty.address,
                    tbtcDepositData.referral,
                    initialDepositAmount,
                    bridgedTbtcAmount,
                    0,
                  )
              })

              it("should emit Deposit event", async () => {
                await expect(tx)
                  .to.emit(acreBtc, "Deposit")
                  .withArgs(
                    await bitcoinDepositor.getAddress(),
                    tbtcDepositData.depositOwner,
                    expectedAssetsAmount,
                    expectedReceivedSharesAmount,
                  )
              })

              it("should deposit in Acre contract", async () => {
                await expect(
                  tx,
                  "invalid minted acreBTC amount",
                ).to.changeTokenBalances(
                  acreBtc,
                  [tbtcDepositData.depositOwner],
                  [expectedReceivedSharesAmount],
                )

                await expect(
                  tx,
                  "invalid deposited tBTC amount",
                ).to.changeTokenBalances(
                  tbtc,
                  [acreBtc],
                  [expectedAssetsAmount],
                )
              })
            })

            describe("when depositor fee exceeds bridged amount", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                await bitcoinDepositor
                  .connect(governance)
                  .updateDepositorFeeDivisor(1)
              })

              it("should revert", async () => {
                await expect(
                  bitcoinDepositor
                    .connect(thirdParty)
                    .finalizeDeposit(tbtcDepositData.depositKey),
                )
                  .to.be.revertedWithCustomError(
                    bitcoinDepositor,
                    "DepositorFeeExceedsBridgedAmount",
                  )
                  .withArgs(initialDepositAmount, bridgedTbtcAmount)
              })
            })
          })
        })

        describe("when deposit has been finalized", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            // Simulate deposit request finalization.
            await finalizeMinting(tbtcDepositData.depositKey)

            // Finalize deposit.
            await bitcoinDepositor
              .connect(thirdParty)
              .finalizeDeposit(tbtcDepositData.depositKey)
          })

          it("should revert", async () => {
            await expect(
              bitcoinDepositor
                .connect(thirdParty)
                .finalizeDeposit(tbtcDepositData.depositKey),
            )
              .to.be.revertedWithCustomError(
                bitcoinDepositor,
                "UnexpectedDepositState",
              )
              .withArgs(DepositState.Finalized, DepositState.Initialized)
          })
        })
      })
    })
  })

  describe("updateMinDepositAmount", () => {
    beforeAfterSnapshotWrapper()

    describe("when caller is not governance", () => {
      beforeAfterSnapshotWrapper()

      it("should revert", async () => {
        await expect(
          bitcoinDepositor.connect(thirdParty).updateMinDepositAmount(1234),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "OwnableUnauthorizedAccount",
          )
          .withArgs(thirdParty.address)
      })
    })

    describe("when caller is governance", () => {
      const testupdateMinDepositAmount = (newValue: bigint) =>
        function () {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await bitcoinDepositor
              .connect(governance)
              .updateMinDepositAmount(newValue)
          })

          it("should emit MinDepositAmountUpdated event", async () => {
            await expect(tx)
              .to.emit(bitcoinDepositor, "MinDepositAmountUpdated")
              .withArgs(newValue)
          })

          it("should update value correctly", async () => {
            expect(await bitcoinDepositor.minDepositAmount()).to.be.eq(newValue)
          })
        }

      beforeAfterSnapshotWrapper()

      // Deposit dust threshold: 1000000 satoshi = 0.01 BTC
      // tBTC Bridge stores the dust threshold in satoshi precision,
      // we need to convert it to the tBTC token precision as `updateMinDepositAmount`
      // function expects this precision.
      const bridgeDepositDustThreshold = to1ePrecision(
        defaultDepositDustThreshold,
        10,
      )

      describe("when new deposit amount is less than bridge deposit dust threshold", () => {
        beforeAfterSnapshotWrapper()
        const newMinDepositAmount = bridgeDepositDustThreshold - 1n

        it("should revert", async () => {
          await expect(
            bitcoinDepositor
              .connect(governance)
              .updateMinDepositAmount(newMinDepositAmount),
          )
            .to.be.revertedWithCustomError(
              bitcoinDepositor,
              "MinDepositAmountLowerThanBridgeMinDeposit",
            )
            .withArgs(newMinDepositAmount, bridgeDepositDustThreshold)
        })
      })

      describe(
        "when new deposit amount is equal to bridge deposit dust threshold",
        testupdateMinDepositAmount(bridgeDepositDustThreshold),
      )

      describe(
        "when new deposit amount is greater than bridge deposit dust threshold",
        testupdateMinDepositAmount(bridgeDepositDustThreshold + 1n),
      )

      describe(
        "when new deposit amount is equal max uint256",
        testupdateMinDepositAmount(MaxUint256),
      )
    })
  })

  describe("updateDepositorFeeDivisor", () => {
    beforeAfterSnapshotWrapper()

    describe("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor.connect(thirdParty).updateDepositorFeeDivisor(1234),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "OwnableUnauthorizedAccount",
          )
          .withArgs(thirdParty.address)
      })
    })

    describe("when caller is governance", () => {
      const testUpdateDepositorFeeDivisor = (newValue: bigint) =>
        function () {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await bitcoinDepositor
              .connect(governance)
              .updateDepositorFeeDivisor(newValue)
          })

          it("should emit DepositorFeeDivisorUpdated event", async () => {
            await expect(tx)
              .to.emit(bitcoinDepositor, "DepositorFeeDivisorUpdated")
              .withArgs(newValue)
          })

          it("should update value correctly", async () => {
            expect(await bitcoinDepositor.depositorFeeDivisor()).to.be.eq(
              newValue,
            )
          })
        }

      describe(
        "when new value is non-zero",
        testUpdateDepositorFeeDivisor(47281n),
      )

      describe("when new value is zero", testUpdateDepositorFeeDivisor(0n))

      describe(
        "when new value is max uint64",
        testUpdateDepositorFeeDivisor(18446744073709551615n),
      )
    })
  })

  describe("updateFeesReimbursementPool", () => {
    beforeAfterSnapshotWrapper()

    describe("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor
            .connect(thirdParty)
            .updateFeesReimbursementPool(ZeroAddress),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "OwnableUnauthorizedAccount",
          )
          .withArgs(thirdParty.address)
      })
    })

    describe("when caller is governance", () => {
      describe("when new value is zero address", () => {
        it("should revert", async () => {
          await expect(
            bitcoinDepositor
              .connect(governance)
              .updateFeesReimbursementPool(ZeroAddress),
          ).to.be.revertedWithCustomError(
            bitcoinDepositor,
            "FeesReimbursementPoolZeroAddress",
          )
        })
      })

      describe("when new value is non-zero address", () => {
        let tx: ContractTransactionResponse

        before(async () => {
          tx = await bitcoinDepositor
            .connect(governance)
            .updateFeesReimbursementPool(thirdParty.address)
        })

        it("should emit FeesReimbursementPoolUpdated event", async () => {
          await expect(tx)
            .to.emit(bitcoinDepositor, "FeesReimbursementPoolUpdated")
            .withArgs(thirdParty.address)
        })

        it("should update value correctly", async () => {
          expect(await bitcoinDepositor.feesReimbursementPool()).to.be.equal(
            thirdParty.address,
          )
        })
      })
    })
  })

  describe("updateBridgeFeesReimbursementThreshold", () => {
    beforeAfterSnapshotWrapper()

    describe("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor
            .connect(thirdParty)
            .updateBridgeFeesReimbursementThreshold(1234),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "OwnableUnauthorizedAccount",
          )
          .withArgs(thirdParty.address)
      })
    })

    describe("when caller is governance", () => {
      const testUpdateBridgeFeesReimbursementThreshold = (newValue: bigint) =>
        function () {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await bitcoinDepositor
              .connect(governance)
              .updateBridgeFeesReimbursementThreshold(newValue)
          })

          it("should emit BridgeFeesReimbursementThresholdUpdated event", async () => {
            await expect(tx)
              .to.emit(
                bitcoinDepositor,
                "BridgeFeesReimbursementThresholdUpdated",
              )
              .withArgs(newValue)
          })

          it("should update value correctly", async () => {
            expect(
              await bitcoinDepositor.bridgeFeesReimbursementThreshold(),
            ).to.be.eq(newValue)
          })
        }

      describe(
        "when new value is non-zero",
        testUpdateBridgeFeesReimbursementThreshold(92193n),
      )

      describe(
        "when new value is zero",
        testUpdateBridgeFeesReimbursementThreshold(0n),
      )
    })
  })

  const extraDataValidTestData = new Map<
    string,
    {
      depositOwner: string
      referral: number
      extraData: string
    }
  >([
    [
      "depositOwner has leading zeros",
      {
        depositOwner: "0x000055d85E80A49B5930C4a77975d44f012D86C1",
        referral: 6851, // hex: 0x1ac3
        extraData:
          "0x000055d85e80a49b5930c4a77975d44f012d86c11ac300000000000000000000",
      },
    ],
    [
      "depositOwner has trailing zeros",
      {
        depositOwner: "0x2d2F8BC7923F7F806Dc9bb2e17F950b42CfE0000",
        referral: 6851, // hex: 0x1ac3
        extraData:
          "0x2d2f8bc7923f7f806dc9bb2e17f950b42cfe00001ac300000000000000000000",
      },
    ],
    [
      "referral is zero",
      {
        depositOwner: "0xeb098d6cDE6A202981316b24B19e64D82721e89E",
        referral: 0,
        extraData:
          "0xeb098d6cde6a202981316b24b19e64d82721e89e000000000000000000000000",
      },
    ],
    [
      "referral has leading zeros",
      {
        depositOwner: "0xeb098d6cDE6A202981316b24B19e64D82721e89E",
        referral: 31, // hex: 0x001f
        extraData:
          "0xeb098d6cde6a202981316b24b19e64d82721e89e001f00000000000000000000",
      },
    ],
    [
      "referral has trailing zeros",
      {
        depositOwner: "0xeb098d6cDE6A202981316b24B19e64D82721e89E",
        referral: 19712, // hex: 0x4d00
        extraData:
          "0xeb098d6cde6a202981316b24b19e64d82721e89e4d0000000000000000000000",
      },
    ],
    [
      "referral is maximum value",
      {
        depositOwner: "0xeb098d6cDE6A202981316b24B19e64D82721e89E",
        referral: 65535, // max uint16
        extraData:
          "0xeb098d6cde6a202981316b24b19e64d82721e89effff00000000000000000000",
      },
    ],
  ])

  describe("encodeExtraData", () => {
    extraDataValidTestData.forEach(
      // eslint-disable-next-line @typescript-eslint/no-shadow
      ({ depositOwner, referral, extraData: expectedExtraData }, testName) => {
        it(testName, async () => {
          expect(
            await bitcoinDepositor.encodeExtraData(depositOwner, referral),
          ).to.be.equal(expectedExtraData)
        })
      },
    )
  })

  describe("decodeExtraData", () => {
    extraDataValidTestData.forEach(
      (
        {
          depositOwner: expectedDepositOwner,
          referral: expectedReferral,
          extraData,
        },
        testName,
      ) => {
        it(testName, async () => {
          const [actualDepositOwner, actualReferral] =
            await bitcoinDepositor.decodeExtraData(extraData)

          expect(actualDepositOwner, "invalid depositOwner").to.be.equal(
            expectedDepositOwner,
          )
          expect(actualReferral, "invalid referral").to.be.equal(
            expectedReferral,
          )
        })
      },
    )

    it("with unused bytes filled with data", async () => {
      // Extra data uses address (20 bytes) and referral (2 bytes), leaving the
      // remaining 10 bytes unused. This test fills the unused bytes with a random
      // value.
      const extraData =
        "0xeb098d6cde6a202981316b24b19e64d82721e89e1ac3105f9919321ea7d75f58"
      const expectedDepositOwner = "0xeb098d6cDE6A202981316b24B19e64D82721e89E"
      const expectedReferral = 6851 // hex: 0x1ac3

      const [actualDepositOwner, actualReferral] =
        await bitcoinDepositor.decodeExtraData(extraData)

      expect(actualDepositOwner, "invalid depositOwner").to.be.equal(
        expectedDepositOwner,
      )
      expect(actualReferral, "invalid referral").to.be.equal(expectedReferral)
    })
  })

  describe("updateAcreVault", () => {
    beforeAfterSnapshotWrapper()

    describe("when caller is not owner", () => {
      it("should revert", async () => {
        await expect(
          bitcoinDepositor
            .connect(thirdParty)
            .updateAcreVault(thirdParty.address),
        )
          .to.be.revertedWithCustomError(
            bitcoinDepositor,
            "OwnableUnauthorizedAccount",
          )
          .withArgs(thirdParty.address)
      })
    })

    describe("when caller is owner", () => {
      describe("when new vault address is zero address", () => {
        it("should revert", async () => {
          await expect(
            bitcoinDepositor.connect(governance).updateAcreVault(ZeroAddress),
          ).to.be.revertedWithCustomError(
            bitcoinDepositor,
            "AcreVaultZeroAddress",
          )
        })
      })

      describe("when new vault address is non-zero address", () => {
        const newVaultAddress = "0x1234567890123456789012345678901234567890"

        let tx: ContractTransactionResponse

        before(async () => {
          tx = await bitcoinDepositor
            .connect(governance)
            .updateAcreVault(newVaultAddress)
        })

        it("should emit AcreVaultUpdated event", async () => {
          await expect(tx)
            .to.emit(bitcoinDepositor, "AcreVaultUpdated")
            .withArgs(newVaultAddress)
        })

        it("should update acre vault address", async () => {
          expect(await bitcoinDepositor.acreVault()).to.be.equal(
            newVaultAddress,
          )
        })
      })
    })
  })

  async function initializeDeposit() {
    await bitcoinDepositor
      .connect(thirdParty)
      .initializeDeposit(
        tbtcDepositData.fundingTxInfo,
        tbtcDepositData.reveal,
        tbtcDepositData.depositOwner,
        tbtcDepositData.referral,
      )
  }

  async function finalizeMinting(depositKey: bigint, amountToMint?: bigint) {
    await tbtcVault.createOptimisticMintingRequest(depositKey)

    // Simulate deposit request finalization via optimistic minting.
    if (amountToMint) {
      await tbtcVault.finalizeOptimisticMintingRequestWithAmount(
        depositKey,
        amountToMint,
      )
    } else {
      await tbtcVault.finalizeOptimisticMintingRequest(depositKey)
    }
  }
})
