import {
  takeSnapshot,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ContractTransactionResponse, MaxUint256, ZeroAddress } from "ethers"
import { ethers, helpers } from "hardhat"

import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { SnapshotRestorer } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"

import { to1e18, feeOnTotal, feeOnRaw } from "./utils"

import {
  StBTC as stBTC,
  AcreBTC as acreBTC,
  TestERC20,
  MezoAllocator,
} from "../typechain"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { tbtc, stbtc, mezoAllocator, acreBtc } = await deployment()
  const { governance, treasury, pauseAdmin, maintainer } =
    await getNamedSigners()

  const [
    depositor1,
    depositor2,
    depositor3,
    sharesOwner1,
    sharesOwner2,
    sharesOwner3,
    thirdParty,
    externalMinter,
  ] = await getUnnamedSigners()

  const amountToMint = to1e18(100000)
  await tbtc.mint(depositor1, amountToMint)
  await tbtc.mint(depositor2, amountToMint)
  await tbtc.mint(depositor3, amountToMint)

  return {
    stbtc,
    tbtc,
    acreBtc,
    depositor1,
    depositor2,
    depositor3,
    sharesOwner1,
    sharesOwner2,
    sharesOwner3,
    governance,
    thirdParty,
    externalMinter,
    treasury,
    mezoAllocator,
    pauseAdmin,
    maintainer,
  }
}

describe("stBTC", () => {
  const entryFeeBasisPoints = 5n // Used only for the tests.
  const exitFeeBasisPoints = 10n // Used only for the tests.

  let stbtc: stBTC
  let tbtc: TestERC20
  let mezoAllocator: MezoAllocator
  let acreBtc: acreBTC

  let governance: HardhatEthersSigner
  let depositor1: HardhatEthersSigner
  let depositor2: HardhatEthersSigner
  let depositor3: HardhatEthersSigner

  let sharesOwner1: HardhatEthersSigner
  let sharesOwner2: HardhatEthersSigner
  let sharesOwner3: HardhatEthersSigner

  let thirdParty: HardhatEthersSigner
  let externalMinter: HardhatEthersSigner
  let treasury: HardhatEthersSigner
  let pauseAdmin: HardhatEthersSigner
  let maintainer: HardhatEthersSigner

  before(async () => {
    ;({
      stbtc,
      tbtc,
      acreBtc,
      depositor1,
      depositor2,
      depositor3,
      sharesOwner1,
      sharesOwner2,
      sharesOwner3,
      governance,
      thirdParty,
      externalMinter,
      treasury,
      mezoAllocator,
      pauseAdmin,
      maintainer,
    } = await loadFixture(fixture))

    await stbtc
      .connect(governance)
      .updateEntryFeeBasisPoints(entryFeeBasisPoints)

    await stbtc.connect(governance).updateExitFeeBasisPoints(exitFeeBasisPoints)
  })

  describe("previewDeposit", () => {
    beforeAfterSnapshotWrapper()

    context("when the vault is empty", () => {
      const amountToDeposit = to1e18(1)

      before(async () => {
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)
      })

      context("when validating preview deposit against hardcoded value", () => {
        it("should return the correct amount of shares", async () => {
          const shares = await stbtc.previewDeposit(amountToDeposit)
          // amount to deposit = 1 tBTC
          // fee = (1e18 * 5) / (10000 + 5) = 499750124937532
          // shares = 1e18 - 499750124937532 = 999500249875062468
          const expectedShares = 999500249875062468n
          expect(shares).to.be.eq(expectedShares)
        })
      })

      context(
        "when previewing shares against programatically calculated values",
        () => {
          it("should return the correct amount of shares", async () => {
            const shares = await stbtc.previewDeposit(amountToDeposit)
            const expectedShares =
              amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
            expect(shares).to.be.eq(expectedShares)
          })
        },
      )
    })

    context("when the vault is not empty", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit1 = to1e18(1)
      const amountToDeposit2 = to1e18(2)

      before(async () => {
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit1)

        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit1, depositor1.address)
      })

      it("should return the correct amount of shares", async () => {
        const expectedShares =
          amountToDeposit2 - feeOnTotal(amountToDeposit2, entryFeeBasisPoints)
        const shares = await stbtc.previewDeposit(amountToDeposit2)
        expect(shares).to.be.eq(expectedShares)
      })
    })
  })

  describe("previewRedeem", () => {
    beforeAfterSnapshotWrapper()

    context("when the vault is empty", () => {
      it("should return correct value", async () => {
        const toRedeem = to1e18(1)
        // fee = (1e18 * 10) / (10000 + 10) = 999000999000999
        // expectedShares = toReedem - fee
        // expectedShares = to1e18(1) - 999000999000999 = 999000999000999001
        const expectedShares = 999000999000999000n // -1 to match the contract's math
        expect(await stbtc.previewRedeem(toRedeem)).to.be.equal(expectedShares)
      })
    })

    context("when the vault is not empty", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(1)

      before(async () => {
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)

        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
      })

      context("when there is no yield generated", () => {
        it("should return the correct amount of assets", async () => {
          const shares = await stbtc.balanceOf(depositor1.address)
          // Preview redeem on already deposited amount for which entry fee was
          // taken.
          const availableAssetsToRedeem = await stbtc.previewRedeem(shares)
          const actualAssets = shares

          const expectedAssetsToRedeem =
            actualAssets - feeOnTotal(actualAssets, exitFeeBasisPoints)
          expect(availableAssetsToRedeem).to.be.eq(expectedAssetsToRedeem)
        })
      })

      context("when there is yield generated", () => {
        beforeAfterSnapshotWrapper()

        const earnedYield = to1e18(6)

        before(async () => {
          await tbtc.mint(await stbtc.getAddress(), earnedYield)
        })

        it("should return the correct amount of assets", async () => {
          const shares = await stbtc.balanceOf(depositor1.address)
          const availableAssetsToRedeem = await stbtc.previewRedeem(shares)
          const actualAssets = shares

          // expected assets = (1 - depositFee(1) + earnedYield) - (exitFee(1 + earnedYield))
          const expectedAssetsToRedeem =
            actualAssets +
            earnedYield -
            feeOnTotal(actualAssets + earnedYield, exitFeeBasisPoints)
          expectCloseTo(availableAssetsToRedeem, expectedAssetsToRedeem)
        })
      })
    })
  })

  describe("previewMint", () => {
    let amountToDeposit: bigint

    beforeAfterSnapshotWrapper()

    context("when validating preview mint against hardcoded value", () => {
      it("should return the correct amount of assets", async () => {
        // 1e18 + 500000000000000
        amountToDeposit = 1000500000000000000n

        const assetsToDeposit = await stbtc.previewMint(to1e18(1))
        expect(assetsToDeposit).to.be.eq(amountToDeposit)
      })
    })

    context(
      "when validating preview mint against programatically calculated value",
      () => {
        context("when the vault is not empty", () => {
          const sharesToMint1 = to1e18(1)
          const sharesToMint2 = to1e18(2)

          // To receive 1 stBTC, a user must deposit 1.0005 tBTC where 0.0005 tBTC
          // is a fee.
          const amountToDeposit1 =
            sharesToMint1 + feeOnRaw(sharesToMint1, entryFeeBasisPoints)

          // To receive 2 stBTC, a user must deposit 2.001 tBTC where 0.001 tBTC
          // is a fee.
          const amountToDeposit2 =
            sharesToMint2 + feeOnRaw(sharesToMint2, entryFeeBasisPoints)

          it("should preview the correct amount of assets for deposit 2", async () => {
            await tbtc
              .connect(depositor1)
              .approve(await stbtc.getAddress(), amountToDeposit1)

            await tbtc
              .connect(depositor2)
              .approve(await stbtc.getAddress(), amountToDeposit2)

            await stbtc
              .connect(depositor1)
              .mint(sharesToMint1, depositor1.address)

            const assets = await stbtc.previewMint(sharesToMint2)
            expect(assets).to.be.eq(amountToDeposit2)
          })
        })
      },
    )
  })

  describe("assetsBalanceOf", () => {
    beforeAfterSnapshotWrapper()

    context("when the vault is empty", () => {
      it("should return zero", async () => {
        expect(await stbtc.assetsBalanceOf(depositor1.address)).to.be.equal(0)
      })
    })

    context("when the vault is not empty", () => {
      context("when there is one depositor", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)

          await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
        })

        it("should return the correct amount of assets", async () => {
          const depositFee = feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          expect(await stbtc.assetsBalanceOf(depositor1.address)).to.be.equal(
            amountToDeposit - depositFee,
          )
        })
      })

      context("when there are two depositors", () => {
        beforeAfterSnapshotWrapper()

        const depositor1AmountToDeposit = to1e18(1)
        const depositor2AmountToDeposit = to1e18(2)

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), depositor1AmountToDeposit)

          await stbtc
            .connect(depositor1)
            .deposit(depositor1AmountToDeposit, depositor1.address)

          await tbtc
            .connect(depositor2)
            .approve(await stbtc.getAddress(), depositor2AmountToDeposit)

          await stbtc
            .connect(depositor2)
            .deposit(depositor2AmountToDeposit, depositor2.address)
        })

        context("when there is no yield generated", () => {
          beforeAfterSnapshotWrapper()

          it("should return the correct amount of assets", async () => {
            const deposit1Fee = feeOnTotal(
              depositor1AmountToDeposit,
              entryFeeBasisPoints,
            )
            const deposit2Fee = feeOnTotal(
              depositor2AmountToDeposit,
              entryFeeBasisPoints,
            )

            expect(
              await stbtc.assetsBalanceOf(depositor1.address),
              "invalid assets balance of depositor 1",
            ).to.be.equal(depositor1AmountToDeposit - deposit1Fee)

            expect(
              await stbtc.assetsBalanceOf(depositor2.address),
              "invalid assets balance of depositor 2",
            ).to.be.equal(depositor2AmountToDeposit - deposit2Fee)
          })
        })

        context("when there is yield generated", () => {
          beforeAfterSnapshotWrapper()

          const earnedYield = to1e18(6)

          // Values are floor rounded as per the `convertToAssets` function.
          // 1 - fee + (1/3 * 6) = ~3
          const expectedAssets1 =
            depositor1AmountToDeposit -
            feeOnTotal(depositor1AmountToDeposit, entryFeeBasisPoints) +
            to1e18(2)
          // 2 - fee + (2/3 * 6) = ~6
          const expectedAssets2 =
            depositor2AmountToDeposit -
            feeOnTotal(depositor2AmountToDeposit, entryFeeBasisPoints) +
            to1e18(4)

          before(async () => {
            await tbtc.mint(await stbtc.getAddress(), earnedYield)
          })

          it("should return the correct amount of assets", async () => {
            expectCloseTo(
              await stbtc.assetsBalanceOf(depositor1.address),
              expectedAssets1,
            )

            expectCloseTo(
              await stbtc.assetsBalanceOf(depositor2.address),
              expectedAssets2,
            )
          })
        })
      })
    })
  })

  describe("deposit", () => {
    beforeAfterSnapshotWrapper()

    context("when staking as first depositor", () => {
      beforeAfterSnapshotWrapper()

      let receiver: HardhatEthersSigner

      before(() => {
        receiver = ethers.Wallet.createRandom()
      })

      context("when amount to deposit is less than minimum", () => {
        beforeAfterSnapshotWrapper()

        let amountToDeposit: bigint
        let minimumDepositAmount: bigint

        before(async () => {
          minimumDepositAmount = await stbtc.minimumDepositAmount()
          amountToDeposit = minimumDepositAmount - 1n
        })

        it("should revert", async () => {
          await expect(
            stbtc
              .connect(depositor1)
              .deposit(amountToDeposit, receiver.address),
          )
            .to.be.revertedWithCustomError(stbtc, "LessThanMinDeposit")
            .withArgs(amountToDeposit, minimumDepositAmount)
        })
      })

      context("when amount to deposit is equal to the minimum amount", () => {
        beforeAfterSnapshotWrapper()

        let amountToDeposit: bigint
        let tx: ContractTransactionResponse
        let expectedReceivedShares: bigint

        before(async () => {
          const minimumDepositAmount = await stbtc.minimumDepositAmount()
          amountToDeposit = minimumDepositAmount

          expectedReceivedShares =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          await tbtc.approve(await stbtc.getAddress(), amountToDeposit)
          tx = await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, receiver.address)
        })

        it("should emit Deposit event", async () => {
          await expect(tx).to.emit(stbtc, "Deposit").withArgs(
            // Caller.
            depositor1.address,
            // Receiver.
            receiver.address,
            // Depositd tokens.
            amountToDeposit,
            // Received shares.
            expectedReceivedShares,
          )
        })

        it("should mint stBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            stbtc,
            [receiver.address],
            [expectedReceivedShares],
          )
        })

        it("should transfer tBTC tokens to Acre", async () => {
          const actualDepositdAmount =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          await expect(tx).to.changeTokenBalances(
            tbtc,
            [depositor1.address, stbtc],
            [-amountToDeposit, actualDepositdAmount],
          )
        })
      })

      context("when the receiver is zero address", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(10)

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)
        })

        it("should revert", async () => {
          await expect(
            stbtc.connect(depositor1).deposit(amountToDeposit, ZeroAddress),
          )
            .to.be.revertedWithCustomError(stbtc, "ERC20InvalidReceiver")
            .withArgs(ZeroAddress)
        })
      })
    })

    describe("when staking by multiple depositors", () => {
      beforeAfterSnapshotWrapper()

      const depositor1AmountToDeposit = to1e18(7)
      const depositor2AmountToDeposit = to1e18(3)
      const earnedYield = to1e18(5)

      let afterDepositsSnapshot: SnapshotRestorer
      let afterSimulatingYieldSnapshot: SnapshotRestorer

      before(async () => {
        // Mint tBTC.
        await tbtc.mint(depositor1.address, depositor1AmountToDeposit)
        await tbtc.mint(depositor2.address, depositor2AmountToDeposit)

        // Approve tBTC.
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), depositor1AmountToDeposit)
        await tbtc
          .connect(depositor2)
          .approve(await stbtc.getAddress(), depositor2AmountToDeposit)
      })

      context("when the vault is in initial state", () => {
        context("when two depositors deposit", () => {
          let depositTx1: ContractTransactionResponse
          let depositTx2: ContractTransactionResponse

          before(async () => {
            depositTx1 = await stbtc
              .connect(depositor1)
              .deposit(depositor1AmountToDeposit, depositor1.address)

            depositTx2 = await stbtc
              .connect(depositor2)
              .deposit(depositor2AmountToDeposit, depositor2.address)

            afterDepositsSnapshot = await takeSnapshot()
          })

          it("depositor 1 should receive shares equal to a deposited amount", async () => {
            const expectedShares =
              depositor1AmountToDeposit -
              feeOnTotal(depositor1AmountToDeposit, entryFeeBasisPoints)

            await expect(depositTx1).to.changeTokenBalances(
              stbtc,
              [depositor1.address],
              [expectedShares],
            )
          })

          it("depositor 2 should receive shares equal to a deposited amount", async () => {
            const expectedShares =
              depositor2AmountToDeposit -
              feeOnTotal(depositor2AmountToDeposit, entryFeeBasisPoints)

            await expect(depositTx2).to.changeTokenBalances(
              stbtc,
              [depositor2.address],
              [expectedShares],
            )
          })

          it("the total assets amount should be equal to all deposited tokens", async () => {
            const actualDepositAmount1 =
              depositor1AmountToDeposit -
              feeOnTotal(depositor1AmountToDeposit, entryFeeBasisPoints)
            const actualDepositAmount2 =
              depositor2AmountToDeposit -
              feeOnTotal(depositor2AmountToDeposit, entryFeeBasisPoints)

            expect(await stbtc.totalAssets()).to.eq(
              actualDepositAmount1 + actualDepositAmount2,
            )
          })
        })
      })

      context("when vault has two depositors", () => {
        context("when vault earns yield", () => {
          let depositor1SharesBefore: bigint
          let depositor2SharesBefore: bigint

          before(async () => {
            // Current state:
            // depositor 1 shares = deposit amount = 7
            // depositor 2 shares = deposit amount = 3
            // Total assets = 7 + 3 + 5 (yield) = 15
            await afterDepositsSnapshot.restore()

            depositor1SharesBefore = await stbtc.balanceOf(depositor1.address)
            depositor2SharesBefore = await stbtc.balanceOf(depositor2.address)

            // Simulating yield returned from strategies. The vault now contains
            // more tokens than deposited which causes the exchange rate to
            // change.
            await tbtc.mint(await stbtc.getAddress(), earnedYield)
          })

          after(async () => {
            afterSimulatingYieldSnapshot = await takeSnapshot()
          })

          it("the vault should hold more assets minus fees", async () => {
            const actualDepositAmount1 =
              depositor1AmountToDeposit -
              feeOnTotal(depositor1AmountToDeposit, entryFeeBasisPoints)
            const actualDepositAmount2 =
              depositor2AmountToDeposit -
              feeOnTotal(depositor2AmountToDeposit, entryFeeBasisPoints)

            expect(await stbtc.totalAssets()).to.be.eq(
              actualDepositAmount1 + actualDepositAmount2 + earnedYield,
            )
          })

          it("the depositors shares should be the same", async () => {
            expect(await stbtc.balanceOf(depositor1.address)).to.be.eq(
              depositor1SharesBefore,
            )
            expect(await stbtc.balanceOf(depositor2.address)).to.be.eq(
              depositor2SharesBefore,
            )
          })
        })

        context("when depositor 1 deposits more tokens", () => {
          const newAmountToDeposit = to1e18(2)
          let sharesBefore: bigint

          before(async () => {
            await afterSimulatingYieldSnapshot.restore()

            sharesBefore = await stbtc.balanceOf(depositor1.address)

            await tbtc.mint(depositor1.address, newAmountToDeposit)

            await tbtc
              .connect(depositor1)
              .approve(await stbtc.getAddress(), newAmountToDeposit)

            await stbtc
              .connect(depositor1)
              .deposit(newAmountToDeposit, depositor1.address)
            // State after deposit:
            // Shares to mint = (assets * stBTCSupply / totalTBTCInAcre) = 2 * 10 / 15 = ~1.333333333333333333
            // Total assets = 7(depositor 1) + 3(depositor 2) + 5(yield) + 2 = 17
            // Total shares = 7 + 3 + ~1.3 = 11.333333333333333333
          })

          it("should receive more shares", async () => {
            const expectedSharesToMint =
              await stbtc.previewDeposit(newAmountToDeposit)

            const shares = await stbtc.balanceOf(depositor1.address)

            expect(shares).to.be.eq(sharesBefore + expectedSharesToMint)
          })
        })
      })
    })
  })

  describe("mint", () => {
    beforeAfterSnapshotWrapper()

    let receiver: HardhatEthersSigner

    before(() => {
      receiver = ethers.Wallet.createRandom()
    })

    context("when minting as first depositor", () => {
      beforeAfterSnapshotWrapper()

      const sharesToMint = to1e18(1)
      let tx: ContractTransactionResponse
      let amountToDeposit: bigint
      let amountToSpend: bigint

      before(async () => {
        amountToDeposit = sharesToMint
        amountToSpend =
          amountToDeposit + feeOnRaw(amountToDeposit, entryFeeBasisPoints)

        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToSpend)

        tx = await stbtc
          .connect(depositor1)
          .mint(sharesToMint, receiver.address)
      })

      it("should emit Deposit event", async () => {
        await expect(tx).to.emit(stbtc, "Deposit").withArgs(
          // Caller.
          depositor1.address,
          // Receiver.
          receiver.address,
          // Deposited tokens including deposit fees.
          amountToSpend,
          // Received shares.
          sharesToMint,
        )
      })

      it("should mint stBTC tokens", async () => {
        await expect(tx).to.changeTokenBalances(
          stbtc,
          [receiver.address],
          [sharesToMint],
        )
      })

      it("should transfer tBTC tokens to Acre", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address, stbtc],
          [-amountToSpend, amountToDeposit],
        )
      })

      it("should transfer tBTC tokens to Treasury", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [treasury.address],
          [feeOnRaw(amountToDeposit, entryFeeBasisPoints)],
        )
      })
    })

    context(
      "when depositor wants to mint less shares than the min deposit amount",
      () => {
        beforeAfterSnapshotWrapper()

        let sharesToMint: bigint
        let minimumDepositAmount: bigint

        before(async () => {
          minimumDepositAmount = await stbtc.minimumDepositAmount()
          const shares =
            minimumDepositAmount -
            feeOnTotal(minimumDepositAmount, entryFeeBasisPoints)

          sharesToMint = shares - 1n
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), await stbtc.previewMint(shares))
        })

        it("should take into account the min deposit amount parameter and revert", async () => {
          // In this test case, there is only one depositor and the token vault has
          // not earned anything yet so received shares are equal to deposited
          // tokens amount.
          const depositAmount = await stbtc.previewMint(sharesToMint)
          await expect(
            stbtc.connect(depositor1).mint(sharesToMint, receiver.address),
          )
            .to.be.revertedWithCustomError(stbtc, "LessThanMinDeposit")
            .withArgs(depositAmount, minimumDepositAmount)
        })
      },
    )
  })

  describe("redeem", () => {
    beforeAfterSnapshotWrapper()

    context("when stBTC did not allocate any assets", () => {
      context("when redeeming from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse
        let amountToRedeem: bigint
        let amountDeposited: bigint
        let shares: bigint

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)
          shares =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
          await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          amountDeposited =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
          amountToRedeem =
            amountDeposited - feeOnTotal(amountDeposited, exitFeeBasisPoints)
          tx = await stbtc
            .connect(depositor1)
            .redeem(shares, thirdParty, depositor1)
        })

        it("should emit Redeem event", async () => {
          await expect(tx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            thirdParty.address,
            // Owner
            depositor1.address,
            // Redeemed tokens.
            amountToRedeem,
            // Burned shares.
            shares,
          )
        })

        it("should burn stBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            stbtc,
            [depositor1.address],
            [-shares],
          )
        })

        it("should transfer tBTC tokens to receiver", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [thirdParty.address],
            [amountToRedeem],
          )
        })

        it("should transfer tBTC tokens to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [treasury.address],
            [feeOnTotal(amountDeposited, exitFeeBasisPoints)],
          )
        })
      })

      context("when redeeming all shares from two deposits", () => {
        const firstDeposit = to1e18(1)
        const secondDeposit = to1e18(2)

        before(async () => {
          const totalDeposit = firstDeposit + secondDeposit
          await tbtc.mint(depositor1.address, totalDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), totalDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          await stbtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)
        })

        it("should be able to redeem tokens from the first and second deposit", async () => {
          const shares = await stbtc.balanceOf(depositor1.address)
          const redeemTx = await stbtc.redeem(
            shares,
            depositor1.address,
            depositor1.address,
          )

          const shares1 =
            firstDeposit - feeOnTotal(firstDeposit, entryFeeBasisPoints)
          const shares2 =
            secondDeposit - feeOnTotal(secondDeposit, entryFeeBasisPoints)
          const expectedAssetsToReceive =
            shares1 +
            shares2 -
            feeOnTotal(shares1 + shares2, exitFeeBasisPoints)

          await expect(redeemTx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            depositor1.address,
            // Owner
            depositor1.address,
            // Redeemed tokens.
            expectedAssetsToReceive,
            // Burned shares.
            shares,
          )
        })
      })
    })

    context("when stBTC allocated all of the assets", () => {
      beforeAfterSnapshotWrapper()

      let tx: ContractTransactionResponse
      let firstDepositBalance: bigint

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC to Mezo Portal.
        await mezoAllocator.connect(maintainer).allocate()
        firstDepositBalance = await mezoAllocator.depositBalance()
        // Depositor redeems 2 stBTC.
        tx = await stbtc
          .connect(depositor1)
          .redeem(to1e18(2), depositor1, depositor1)
      })

      it("should transfer tBTC back to a depositor1", async () => {
        const expectedRedeemedAssets =
          to1e18(2) - feeOnTotal(to1e18(2), exitFeeBasisPoints)
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address],
          [expectedRedeemedAssets],
        )
      })

      it("should transfer redeem fee to Treasury", async () => {
        const redeemFee = feeOnTotal(to1e18(2), exitFeeBasisPoints)
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [treasury.address],
          [redeemFee],
        )
      })

      it("should decrease the deposit balance tracking in Mezo Allocator", async () => {
        const depositBalance = await mezoAllocator.depositBalance()
        const redeemFee = feeOnTotal(to1e18(2), exitFeeBasisPoints)
        const assetsToWithdraw = to1e18(2) - redeemFee
        const assetsToWithdrawFromMezo = assetsToWithdraw + redeemFee

        expect(depositBalance).to.be.eq(
          firstDepositBalance - assetsToWithdrawFromMezo,
        )
      })

      it("should emit Withdraw event", async () => {
        const assetsToWithdraw =
          to1e18(2) - feeOnTotal(to1e18(2), exitFeeBasisPoints)

        await expect(tx)
          .to.emit(stbtc, "Withdraw")
          .withArgs(
            depositor1.address,
            depositor1.address,
            depositor1.address,
            assetsToWithdraw,
            to1e18(2),
          )
      })
    })

    context("when stBTC allocated some of the assets", () => {
      beforeAfterSnapshotWrapper()

      let tx: ContractTransactionResponse
      let firstDepositBalance: bigint

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC to Mezo Portal.
        await mezoAllocator.connect(maintainer).allocate()
        firstDepositBalance = await mezoAllocator.depositBalance()
        // Donate 1 tBTC to stBTC.
        await tbtc.mint(await stbtc.getAddress(), to1e18(1))
        // Depositor redeems 2 stBTC.
        tx = await stbtc
          .connect(depositor1)
          .redeem(to1e18(2), depositor1, depositor1)
      })

      it("should transfer tBTC back to a depositor1", async () => {
        // adjusting for rounding
        const expectedRedeemedAssets =
          (await stbtc.previewRedeem(to1e18(2))) - 2n
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address],
          [expectedRedeemedAssets],
        )
      })

      it("should use all unallocated assets", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [await stbtc.getAddress()],
          [-to1e18(1)],
        )
      })

      it("should transfer redeem fee to Treasury", async () => {
        const assetsToWithdraw = await stbtc.previewRedeem(to1e18(2))
        const redeemFee = feeOnRaw(assetsToWithdraw, exitFeeBasisPoints)
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [treasury.address],
          [redeemFee],
        )
      })

      it("should decrease the deposit balance tracking in Mezo Allocator", async () => {
        const depositBalance = await mezoAllocator.depositBalance()
        const assetsToWithdraw = await stbtc.previewRedeem(to1e18(2))
        const redeemFee = feeOnRaw(assetsToWithdraw, exitFeeBasisPoints)
        // adjusting for rounding
        const assetsToWithdrawFromMezo =
          assetsToWithdraw + redeemFee - to1e18(1) - 2n

        expect(depositBalance).to.be.eq(
          firstDepositBalance - assetsToWithdrawFromMezo,
        )
      })

      it("should emit Withdraw event", async () => {
        // adjust for rounding
        const assetsToWithdraw = (await stbtc.previewRedeem(to1e18(2))) - 2n

        await expect(tx)
          .to.emit(stbtc, "Withdraw")
          .withArgs(
            depositor1.address,
            depositor1.address,
            depositor1.address,
            assetsToWithdraw,
            to1e18(2),
          )
      })
    })

    context("when the entry and exit fee is zero", () => {
      beforeAfterSnapshotWrapper()

      context("when redeeming from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse

        before(async () => {
          await stbtc.connect(governance).updateExitFeeBasisPoints(0)
          await stbtc.connect(governance).updateEntryFeeBasisPoints(0)

          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)

          await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await stbtc
            .connect(depositor1)
            .redeem(amountToDeposit, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            thirdParty.address,
            // Owner
            depositor1.address,
            // Redeemed tokens.
            amountToDeposit,
            // Burned shares.
            amountToDeposit,
          )
        })

        it("should burn stBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            stbtc,
            [depositor1.address],
            [-amountToDeposit],
          )
        })

        it("should transfer tBTC tokens to a receiver", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [thirdParty.address],
            [amountToDeposit],
          )
        })

        it("should not transfer any tBTC tokens to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(tbtc, [treasury.address], [0])
        })
      })
    })
  })

  describe("withdraw", () => {
    beforeAfterSnapshotWrapper()

    context("when stBTC did not allocate any assets", () => {
      context("when withdrawing from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse
        let availableToWithdraw: bigint
        let shares: bigint

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)
          shares = 999500249875062468n
          availableToWithdraw = 998501748126935532n
          await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await stbtc
            .connect(depositor1)
            .withdraw(availableToWithdraw, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            thirdParty.address,
            // Owner
            depositor1.address,
            // Available assets to withdraw.
            availableToWithdraw,
            // Burned shares.
            shares,
          )
        })

        it("should burn stBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            stbtc,
            [depositor1.address],
            [-shares],
          )
        })

        it("should transfer tBTC tokens to a Receiver", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [thirdParty.address],
            [availableToWithdraw],
          )
        })

        it("should transfer tBTC tokens to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [treasury.address],
            [feeOnRaw(availableToWithdraw, exitFeeBasisPoints)],
          )
        })
      })

      context("when withdrawing all shares from two deposits", () => {
        const firstDeposit = to1e18(1)
        const secondDeposit = to1e18(2)
        let withdrawTx: ContractTransactionResponse
        let availableToWithdraw: bigint
        let shares: bigint

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit + secondDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit + secondDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)

          await stbtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)

          shares = 2998500749625187405n
          availableToWithdraw = 2995505244380806598n
          withdrawTx = await stbtc.withdraw(
            availableToWithdraw,
            depositor1.address,
            depositor1.address,
          )
        })

        it("should emit Withdraw event", async () => {
          await expect(withdrawTx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            depositor1.address,
            // Owner
            depositor1.address,
            // Available assets to withdraw including fees. Actual assets sent to
            // a user will be less because of the exit fee.
            availableToWithdraw,
            // Burned shares.
            shares,
          )
        })

        it("should burn stBTC tokens", async () => {
          await expect(withdrawTx).to.changeTokenBalances(
            stbtc,
            [depositor1.address],
            [-shares],
          )
        })

        it("should transfer tBTC tokens to a deposit owner", async () => {
          await expect(withdrawTx).to.changeTokenBalances(
            tbtc,
            [depositor1.address],
            [availableToWithdraw],
          )
        })

        it("should transfer tBTC tokens to Treasury", async () => {
          await expect(withdrawTx).to.changeTokenBalances(
            tbtc,
            [treasury.address],
            [feeOnRaw(availableToWithdraw, exitFeeBasisPoints)],
          )
        })
      })
    })

    context("when stBTC allocated all of the assets", () => {
      beforeAfterSnapshotWrapper()

      let tx: ContractTransactionResponse
      let firstDepositBalance: bigint

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC to Mezo Portal.
        await mezoAllocator.connect(maintainer).allocate()
        firstDepositBalance = await mezoAllocator.depositBalance()
        // Depositor withdraws 2 stBTC.
        tx = await stbtc
          .connect(depositor1)
          .withdraw(to1e18(2), depositor1, depositor1)
      })

      it("should transfer tBTC back to a depositor1", async () => {
        const expectedWithdrawnAssets = to1e18(2)

        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address],
          [expectedWithdrawnAssets],
        )
      })

      it("should transfer withdrawal fee to Treasury", async () => {
        const assetsToWithdraw = to1e18(2)
        const withdrawFee = feeOnRaw(assetsToWithdraw, exitFeeBasisPoints)

        await expect(tx).to.changeTokenBalances(
          tbtc,
          [treasury.address],
          [withdrawFee],
        )
      })

      it("should decrease the deposit balance tracking in Mezo Allocator", async () => {
        const depositBalance = await mezoAllocator.depositBalance()
        const assetsToWithdraw = to1e18(2)
        const withdrawFee = feeOnRaw(assetsToWithdraw, exitFeeBasisPoints)
        const assetsToWithdrawFromMezo = assetsToWithdraw + withdrawFee

        expect(depositBalance).to.be.eq(
          firstDepositBalance - assetsToWithdrawFromMezo,
        )
      })

      it("should emit Withdraw event", async () => {
        const assetsToWithdraw = to1e18(2)
        const sharesToBurn =
          to1e18(2) + feeOnRaw(assetsToWithdraw, exitFeeBasisPoints)

        await expect(tx)
          .to.emit(stbtc, "Withdraw")
          .withArgs(
            depositor1.address,
            depositor1.address,
            depositor1.address,
            assetsToWithdraw,
            sharesToBurn,
          )
      })
    })

    context("when stBTC allocated some of the assets", () => {
      beforeAfterSnapshotWrapper()

      let tx: ContractTransactionResponse
      let firstDepositBalance: bigint

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await stbtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC to Mezo Portal.
        await mezoAllocator.connect(maintainer).allocate()
        firstDepositBalance = await mezoAllocator.depositBalance()
        // Donate 1 tBTC to stBTC.
        await tbtc.mint(await stbtc.getAddress(), to1e18(1))
        // Depositor withdraws 2 tBTC.
        tx = await stbtc
          .connect(depositor1)
          .withdraw(to1e18(2), depositor1, depositor1)
      })

      it("should transfer 2 tBTC back to a depositor1", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address],
          [to1e18(2)],
        )
      })

      it("should use all unallocated assets", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [await stbtc.getAddress()],
          [-to1e18(1)],
        )
      })

      it("should transfer withdrawal fee to Treasury", async () => {
        const withdrawalFee = feeOnRaw(to1e18(2), exitFeeBasisPoints)
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [treasury.address],
          [withdrawalFee],
        )
      })

      it("should decrease the deposit balance tracking in Mezo Allocator", async () => {
        const depositBalance = await mezoAllocator.depositBalance()
        const withdrawalFee = feeOnRaw(to1e18(2), exitFeeBasisPoints)
        const assetsToWithdrawFromMezo = to1e18(2) + withdrawalFee - to1e18(1)

        expect(depositBalance).to.be.eq(
          firstDepositBalance - assetsToWithdrawFromMezo,
        )
      })

      it("should emit Withdraw event", async () => {
        // total assets and total supply right after the deposit of 3 tBTC, before
        // the yield and withdrawal. This also includes the entry fee.
        // totalAssets() -> 2998500749625187406n
        // totalSupply() -> 2998500749625187406n

        // Donate 1 tBTC to stBTC.
        // totalAssets() -> 3998500749625187406n (tBTC)
        // totalSupply() -> 2998500749625187406n (stBTC)

        // Withdraw 2 tBTC.
        // sharesToBurnWithNoFees = 2tBTC * totalAssets() / totalSupply()
        // sharesToBurnWithNoFees = 2tBTC * 3998500749625187406n / 2998500749625187406n
        const sharesToBurnWithNoFees = 1499812523434570678n

        // Add the withdrawal fee. Adjust for rounding.
        const sharesToBurn =
          sharesToBurnWithNoFees +
          feeOnRaw(sharesToBurnWithNoFees, exitFeeBasisPoints) +
          1n

        await expect(tx)
          .to.emit(stbtc, "Withdraw")
          .withArgs(
            depositor1.address,
            depositor1.address,
            depositor1.address,
            to1e18(2),
            sharesToBurn,
          )
      })
    })

    context("when the entry and exit fee is zero", () => {
      beforeAfterSnapshotWrapper()

      context("when withdrawing from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse

        before(async () => {
          await stbtc.connect(governance).updateExitFeeBasisPoints(0)
          await stbtc.connect(governance).updateEntryFeeBasisPoints(0)

          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), amountToDeposit)

          await stbtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await stbtc
            .connect(depositor1)
            .withdraw(amountToDeposit, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(stbtc, "Withdraw").withArgs(
            // Caller.
            depositor1.address,
            // Receiver
            thirdParty.address,
            // Owner
            depositor1.address,
            // Withdrew tokens.
            amountToDeposit,
            // Burned shares.
            amountToDeposit,
          )
        })

        it("should burn stBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            stbtc,
            [depositor1.address],
            [-amountToDeposit],
          )
        })

        it("should transfer tBTC tokens to a receiver", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [thirdParty.address],
            [amountToDeposit],
          )
        })

        it("should not transfer any tBTC tokens to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(tbtc, [treasury.address], [0])
        })
      })
    })
  })

  describe("updateMinimumDepositAmount", () => {
    beforeAfterSnapshotWrapper()

    const validMinimumDepositAmount = to1e18(1)

    context("when is called by governance", () => {
      context("when all parameters are valid", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        before(async () => {
          tx = await stbtc
            .connect(governance)
            .updateMinimumDepositAmount(validMinimumDepositAmount)
        })

        it("should emit MinimumDepositAmountUpdated event", async () => {
          await expect(tx)
            .to.emit(stbtc, "MinimumDepositAmountUpdated")
            .withArgs(validMinimumDepositAmount)
        })

        it("should update parameters correctly", async () => {
          const minimumDepositAmount = await stbtc.minimumDepositAmount()

          expect(minimumDepositAmount).to.be.eq(validMinimumDepositAmount)
        })
      })

      context("when minimum deposit amount is 0", () => {
        beforeAfterSnapshotWrapper()

        const newMinimumDepositAmount = 0

        before(async () => {
          await stbtc
            .connect(governance)
            .updateMinimumDepositAmount(newMinimumDepositAmount)
        })

        it("should update the minimum deposit amount correctly", async () => {
          const minimumDepositAmount = await stbtc.minimumDepositAmount()

          expect(minimumDepositAmount).to.be.eq(newMinimumDepositAmount)
        })
      })
    })

    context("when it is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          stbtc
            .connect(depositor1)
            .updateMinimumDepositAmount(validMinimumDepositAmount),
        )
          .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
          .withArgs(depositor1.address)
      })
    })
  })

  describe("updateDispatcher", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(stbtc.connect(thirdParty).updateDispatcher(ZeroAddress))
          .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
          .withArgs(thirdParty.address)
      })
    })

    context("when caller is governance", () => {
      context("when a new dispatcher is zero address", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateDispatcher(ZeroAddress),
          ).to.be.revertedWithCustomError(stbtc, "ZeroAddress")
        })
      })

      context("when a new dispatcher is the same as the old one", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateDispatcher(mezoAllocator),
          ).to.be.revertedWithCustomError(stbtc, "SameDispatcher")
        })
      })

      context("when a new dispatcher is non-zero address", () => {
        let newDispatcher: string
        let stbtcAddress: string
        let dispatcherAddress: string
        let tx: ContractTransactionResponse

        before(async () => {
          // Dispatcher is set by the deployment scripts. See deployment tests
          // where initial parameters are checked.
          dispatcherAddress = await mezoAllocator.getAddress()
          newDispatcher = await ethers.Wallet.createRandom().getAddress()
          stbtcAddress = await stbtc.getAddress()

          tx = await stbtc.connect(governance).updateDispatcher(newDispatcher)
        })

        it("should update the dispatcher", async () => {
          expect(await stbtc.dispatcher()).to.be.equal(newDispatcher)
        })

        it("should reset approval amount for the old dispatcher", async () => {
          const allowance = await tbtc.allowance(
            stbtcAddress,
            dispatcherAddress,
          )
          expect(allowance).to.be.equal(0)
        })

        it("should approve max amount for the new dispatcher", async () => {
          const allowance = await tbtc.allowance(stbtcAddress, newDispatcher)
          expect(allowance).to.be.equal(MaxUint256)
        })

        it("should emit DispatcherUpdated event", async () => {
          await expect(tx)
            .to.emit(stbtc, "DispatcherUpdated")
            .withArgs(dispatcherAddress, newDispatcher)
        })
      })
    })
  })

  describe("updateTreasury", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(stbtc.connect(thirdParty).updateTreasury(ZeroAddress))
          .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
          .withArgs(thirdParty.address)
      })
    })

    context("when caller is governance", () => {
      context("when a new treasury is zero address", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateTreasury(ZeroAddress),
          ).to.be.revertedWithCustomError(stbtc, "ZeroAddress")
        })
      })

      context("when a new treasury is same as the old one", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateTreasury(treasury),
          ).to.be.revertedWithCustomError(stbtc, "SameTreasury")
        })
      })

      context("when a new treasury is Acre address", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateTreasury(stbtc),
          ).to.be.revertedWithCustomError(stbtc, "DisallowedAddress")
        })
      })

      context("when a new treasury is an allowed address", () => {
        let oldTreasury: string
        let newTreasury: string
        let tx: ContractTransactionResponse

        before(async () => {
          // Treasury is set by the deployment scripts. See deployment tests
          // where initial parameters are checked.
          oldTreasury = await stbtc.treasury()
          newTreasury = await ethers.Wallet.createRandom().getAddress()

          tx = await stbtc.connect(governance).updateTreasury(newTreasury)
        })

        it("should update the treasury", async () => {
          expect(await stbtc.treasury()).to.be.equal(newTreasury)
        })

        it("should emit TreasuryUpdated event", async () => {
          await expect(tx)
            .to.emit(stbtc, "TreasuryUpdated")
            .withArgs(oldTreasury, newTreasury)
        })
      })
    })
  })

  describe("pausable", () => {
    describe("pause", () => {
      context("when the authorized account wants to pause contract", () => {
        context("when caller is the owner", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            tx = await stbtc.connect(governance).pause()
          })

          it("should change the pause state", async () => {
            expect(await stbtc.paused()).to.be.true
          })

          it("should emit `Paused` event", async () => {
            await expect(tx)
              .to.emit(stbtc, "Paused")
              .withArgs(governance.address)
          })
        })

        context("when caller is the pause admin", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            tx = await stbtc.connect(pauseAdmin).pause()
          })

          it("should change the pause state", async () => {
            expect(await stbtc.paused()).to.be.true
          })

          it("should emit `Paused` event", async () => {
            await expect(tx)
              .to.emit(stbtc, "Paused")
              .withArgs(pauseAdmin.address)
          })
        })

        context("when updating pause admin to the same address", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            await expect(
              stbtc.connect(governance).updatePauseAdmin(pauseAdmin.address),
            ).to.be.revertedWithCustomError(stbtc, "SamePauseAdmin")
          })
        })
      })

      context("when the unauthorized account tries to pause contract", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(stbtc.connect(thirdParty).pause())
            .to.be.revertedWithCustomError(stbtc, "PausableUnauthorizedAccount")
            .withArgs(thirdParty.address)
        })
      })

      context("when contract is already paused", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await stbtc.connect(pauseAdmin).pause()
        })

        it("should revert", async () => {
          await expect(
            stbtc.connect(pauseAdmin).pause(),
          ).to.be.revertedWithCustomError(stbtc, "EnforcedPause")
        })
      })
    })

    describe("unpause", () => {
      context("when the authorized account wants to unpause contract", () => {
        context("when caller is the owner", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            await stbtc.connect(governance).pause()

            tx = await stbtc.connect(governance).unpause()
          })

          it("should change the pause state", async () => {
            expect(await stbtc.paused()).to.be.false
          })

          it("should emit `Unpaused` event", async () => {
            await expect(tx)
              .to.emit(stbtc, "Unpaused")
              .withArgs(governance.address)
          })
        })

        context("when caller is the pause admin", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            await stbtc.connect(pauseAdmin).pause()

            tx = await stbtc.connect(pauseAdmin).unpause()
          })

          it("should change the pause state", async () => {
            expect(await stbtc.paused()).to.be.false
          })

          it("should emit `Unpaused` event", async () => {
            await expect(tx)
              .to.emit(stbtc, "Unpaused")
              .withArgs(pauseAdmin.address)
          })
        })
      })

      context("when the unauthorized account tries to unpause contract", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(stbtc.connect(thirdParty).unpause())
            .to.be.revertedWithCustomError(stbtc, "PausableUnauthorizedAccount")
            .withArgs(thirdParty.address)
        })
      })

      context("when contract is already unpaused", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            stbtc.connect(pauseAdmin).unpause(),
          ).to.be.revertedWithCustomError(stbtc, "ExpectedPause")
        })
      })
    })

    describe("contract functions", () => {
      const amount = to1e18(100)
      beforeAfterSnapshotWrapper()

      before(async () => {
        await tbtc.mint(depositor1.address, amount)
        await tbtc.connect(depositor1).approve(await stbtc.getAddress(), amount)
        await stbtc.connect(depositor1).deposit(amount, depositor1)
        await stbtc.connect(pauseAdmin).pause()
      })

      it("should pause deposits", async () => {
        await expect(stbtc.connect(depositor1).deposit(amount, depositor1))
          .to.be.revertedWithCustomError(stbtc, "ERC4626ExceededMaxDeposit")
          .withArgs(depositor1.address, amount, 0)
      })

      it("should pause minting", async () => {
        await expect(stbtc.connect(depositor1).mint(amount, depositor1))
          .to.be.revertedWithCustomError(stbtc, "ERC4626ExceededMaxMint")
          .withArgs(depositor1.address, amount, 0)
      })

      it("should pause withdrawals", async () => {
        await expect(
          stbtc.connect(depositor1).withdraw(to1e18(1), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(stbtc, "ERC4626ExceededMaxWithdraw")
          .withArgs(depositor1.address, to1e18(1), 0)
      })

      it("should pause redemptions", async () => {
        await expect(
          stbtc.connect(depositor1).redeem(to1e18(1), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(stbtc, "ERC4626ExceededMaxRedeem")
          .withArgs(depositor1.address, to1e18(1), 0)
      })

      it("should return 0 when calling maxDeposit", async () => {
        expect(await stbtc.maxDeposit(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxMint", async () => {
        expect(await stbtc.maxMint(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxRedeem", async () => {
        expect(await stbtc.maxRedeem(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxWithdraw", async () => {
        expect(await stbtc.maxWithdraw(depositor1)).to.be.eq(0)
      })
    })
  })

  describe("updateEntryFeeBasisPoints", () => {
    beforeAfterSnapshotWrapper()

    const validEntryFeeBasisPoints = 100n // 1%

    context("when called by the governance", () => {
      context("when entry fee basis points are valid", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        before(async () => {
          tx = await stbtc
            .connect(governance)
            .updateEntryFeeBasisPoints(validEntryFeeBasisPoints)
        })

        it("should emit EntryFeeBasisPointsUpdated event", async () => {
          await expect(tx)
            .to.emit(stbtc, "EntryFeeBasisPointsUpdated")
            .withArgs(validEntryFeeBasisPoints)
        })

        it("should update entry fee basis points correctly", async () => {
          expect(await stbtc.entryFeeBasisPoints()).to.be.eq(
            validEntryFeeBasisPoints,
          )
        })
      })

      context("when entry fee basis points are 0", () => {
        beforeAfterSnapshotWrapper()

        const newEntryFeeBasisPoints = 0

        before(async () => {
          await stbtc
            .connect(governance)
            .updateEntryFeeBasisPoints(newEntryFeeBasisPoints)
        })

        it("should update entry fee basis points correctly", async () => {
          expect(await stbtc.entryFeeBasisPoints()).to.be.eq(
            newEntryFeeBasisPoints,
          )
        })
      })

      context("when entry fee basis points exceed 10000", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateEntryFeeBasisPoints(10001n),
          ).to.be.revertedWithCustomError(stbtc, "ExceedsMaxFeeBasisPoints")
        })
      })
    })

    context("when is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          stbtc.connect(depositor1).updateEntryFeeBasisPoints(100n),
        ).to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
      })
    })
  })

  describe("updateExitFeeBasisPoints", () => {
    beforeAfterSnapshotWrapper()

    const validExitFeeBasisPoints = 100n // 1%

    context("when called by the governance", () => {
      context("when exit fee basis points are valid", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        before(async () => {
          tx = await stbtc
            .connect(governance)
            .updateExitFeeBasisPoints(validExitFeeBasisPoints)
        })

        it("should emit ExitFeeBasisPointsUpdated event", async () => {
          await expect(tx)
            .to.emit(stbtc, "ExitFeeBasisPointsUpdated")
            .withArgs(validExitFeeBasisPoints)
        })

        it("should update exit fee basis points correctly", async () => {
          expect(await stbtc.exitFeeBasisPoints()).to.be.eq(
            validExitFeeBasisPoints,
          )
        })
      })

      context("when exit fee basis points exceed 10000", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).updateExitFeeBasisPoints(10001n),
          ).to.be.revertedWithCustomError(stbtc, "ExceedsMaxFeeBasisPoints")
        })
      })

      context("when exit fee basis points are 0", () => {
        beforeAfterSnapshotWrapper()

        const newExitFeeBasisPoints = 0

        before(async () => {
          await stbtc
            .connect(governance)
            .updateExitFeeBasisPoints(newExitFeeBasisPoints)
        })

        it("should update exit fee basis points correctly", async () => {
          expect(await stbtc.exitFeeBasisPoints()).to.be.eq(
            newExitFeeBasisPoints,
          )
        })
      })
    })

    context("when is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          stbtc.connect(depositor1).updateExitFeeBasisPoints(100n),
        ).to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
      })
    })
  })

  describe("totalAssets", () => {
    beforeAfterSnapshotWrapper()

    const donation = to1e18(1)
    const firstDeposit = to1e18(2)
    const secondDeposit = to1e18(3)

    context("when there are no deposits", () => {
      it("should return 0", async () => {
        expect(await stbtc.totalAssets()).to.be.eq(0)
      })
    })

    context("when there are deposits", () => {
      context("when there is a first deposit made", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
        })

        it("should return the total assets", async () => {
          const expectedAssets =
            firstDeposit - feeOnTotal(firstDeposit, entryFeeBasisPoints)
          expect(await stbtc.totalAssets()).to.be.eq(expectedAssets)
        })

        it("should be equal to tBTC balance of the contract", async () => {
          expect(await stbtc.totalAssets()).to.be.eq(
            await tbtc.balanceOf(await stbtc.getAddress()),
          )
        })
      })

      context("when there are two deposits made", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit + secondDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit + secondDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          await stbtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)
        })

        it("should return the total assets", async () => {
          const expectedAssetsFirstDeposit =
            firstDeposit - feeOnTotal(firstDeposit, entryFeeBasisPoints)
          const expectedAssetsSecondDeposit =
            secondDeposit - feeOnTotal(secondDeposit, entryFeeBasisPoints)
          expect(await stbtc.totalAssets()).to.be.eq(
            expectedAssetsFirstDeposit + expectedAssetsSecondDeposit,
          )
        })
      })

      context("when the funds were allocated after deposits", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit + secondDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit + secondDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          await stbtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)
          await mezoAllocator.connect(maintainer).allocate()
        })

        it("should return the total assets", async () => {
          const deposits = firstDeposit + secondDeposit
          const expectedAssets =
            deposits - feeOnTotal(deposits, entryFeeBasisPoints)
          expect(await stbtc.totalAssets()).to.be.eq(expectedAssets)
        })
      })

      context("when there is a donation made", () => {
        beforeAfterSnapshotWrapper()

        let totalAssetsBeforeDonation: bigint

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          totalAssetsBeforeDonation = await stbtc.totalAssets()
          await tbtc.mint(await stbtc.getAddress(), donation)
        })

        it("should return the total assets", async () => {
          expect(await stbtc.totalAssets()).to.be.eq(
            totalAssetsBeforeDonation + donation,
          )
        })
      })

      context("when there was a withdrawal", () => {
        beforeAfterSnapshotWrapper()

        let totalAssetsBeforeWithdrawal: bigint

        before(async () => {
          await tbtc.mint(depositor1.address, firstDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), firstDeposit)
          await stbtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          totalAssetsBeforeWithdrawal = await stbtc.totalAssets()
          await stbtc
            .connect(depositor1)
            .withdraw(to1e18(1), depositor1, depositor1)
        })

        it("should return the total assets", async () => {
          const actualWithdrawnAssets =
            to1e18(1) + feeOnRaw(to1e18(1), exitFeeBasisPoints)
          expect(await stbtc.totalAssets()).to.be.eq(
            totalAssetsBeforeWithdrawal - actualWithdrawnAssets,
          )
        })
      })
    })
  })

  describe("maxWithdraw", () => {
    beforeAfterSnapshotWrapper()
    const amountToDeposit = to1e18(1)
    let expectedDepositedAmount: bigint
    let expectedWithdrawnAmount: bigint

    before(async () => {
      await tbtc
        .connect(depositor1)
        .approve(await stbtc.getAddress(), amountToDeposit)
      await stbtc
        .connect(depositor1)
        .deposit(amountToDeposit, depositor1.address)
      expectedDepositedAmount =
        amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
      expectedWithdrawnAmount =
        expectedDepositedAmount -
        feeOnTotal(expectedDepositedAmount, exitFeeBasisPoints)
    })

    it("should account for the exit fee", async () => {
      const maxWithdraw = await stbtc.maxWithdraw(depositor1.address)

      expect(maxWithdraw).to.be.eq(expectedWithdrawnAmount)
    })

    it("should be equal to the actual redeemable amount", async () => {
      const maxWithdraw = await stbtc.maxWithdraw(depositor1.address)
      const availableShares = await stbtc.balanceOf(depositor1.address)

      const tx = await stbtc.redeem(
        availableShares,
        depositor1.address,
        depositor1.address,
      )

      await expect(tx).to.changeTokenBalances(
        tbtc,
        [depositor1.address],
        [maxWithdraw],
      )
    })
  })

  describe("non fungible withdrawals", () => {
    describe("disableNonFungibleWithdrawals", () => {
      beforeAfterSnapshotWrapper()

      context("when caller is not governance", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(thirdParty).disableNonFungibleWithdrawals(),
          )
            .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
            .withArgs(thirdParty.address)
        })
      })

      context("when caller is governance", () => {
        context("when non fungible withdrawals are disabled", () => {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            await stbtc.connect(governance).disableNonFungibleWithdrawals()

            tx = await stbtc.connect(governance).disableNonFungibleWithdrawals()
          })

          it("should emit NonFungibleWithdrawalsDisabled event", async () => {
            await expect(tx).to.emit(stbtc, "NonFungibleWithdrawalsDisabled")
          })

          it("should disable non fungible withdrawals", async () => {
            expect(await stbtc.nonFungibleWithdrawalsEnabled()).to.be.false
          })
        })

        context("when non fungible withdrawals are enabled", () => {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await stbtc.connect(governance).disableNonFungibleWithdrawals()
          })

          it("should emit NonFungibleWithdrawalsDisabled event", async () => {
            await expect(tx).to.emit(stbtc, "NonFungibleWithdrawalsDisabled")
          })

          it("should disable non fungible withdrawals", async () => {
            expect(await stbtc.nonFungibleWithdrawalsEnabled()).to.be.false
          })
        })
      })
    })

    describe("withdrawable amount tracking", () => {
      beforeAfterSnapshotWrapper()

      /** The amount of assets the first depositor will deposit. */
      const depositAmount1 = to1e18(3)
      /** The actually deposited amount after the fee is subtracted. */
      const depositAmountNet1 =
        depositAmount1 - feeOnTotal(depositAmount1, entryFeeBasisPoints)
      /**
       * Expected total shares amount received by the receiver 1.
       * The deposit is made before the earned yield, so the assets to shares
       * conversion ratio is 1:1.
       */
      const expectedSharesAmount1 = depositAmountNet1

      /** The amount of assets the vault will earn before the second deposit. */
      const earnedYield = to1e18(6)

      /** The amount of assets the second depositor will deposit. */
      const depositAmount2 = to1e18(2)
      /** The actually deposited amount after the fee is subtracted.  */
      const depositAmountNet2 =
        depositAmount2 - feeOnTotal(depositAmount2, entryFeeBasisPoints)
      /**
       * Expected total shares amount received by the receiver 2.
       * The deposit is made after the earned yield, so the assets to shares
       * conversion ratio is no longer 1:1, we need to calculate amount of shares.
       */
      const expectedSharesAmount2 =
        (depositAmountNet2 * expectedSharesAmount1) /
          (depositAmountNet1 + earnedYield) +
        1n

      /** The amount of shares the third depositor will mint. */
      const mintAmount3 = to1e18(1)

      /**
       * Initial state, mixing deposits created with `deposit` and `mint` functions,
       * to confirm that withdrawable shares are tracked for these both methods with
       * the common internal `_withdraw` function.
       * Added earned yield, to introduce non 1-to-1 assets to shares conversion
       * ration.
       */
      async function setupDeposits() {
        // 1. Deposit
        await tbtc
          .connect(depositor1)
          .approve(await stbtc.getAddress(), depositAmount1)

        await stbtc
          .connect(depositor1)
          .deposit(depositAmount1, sharesOwner1.address)

        // Earned Yield
        await tbtc.mint(await stbtc.getAddress(), earnedYield)

        // 2. Deposit
        await tbtc
          .connect(depositor2)
          .approve(await stbtc.getAddress(), depositAmount2)

        await stbtc
          .connect(depositor2)
          .deposit(depositAmount2, sharesOwner2.address)

        // 3. Mint
        await tbtc
          .connect(depositor3)
          .approve(
            await stbtc.getAddress(),
            await stbtc.previewMint(mintAmount3),
          )

        await stbtc.connect(depositor3).mint(mintAmount3, sharesOwner3.address)
      }

      describe("deposit and mint", () => {
        beforeAfterSnapshotWrapper()

        describe("when non fungible withdrawals are enabled", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await setupDeposits()
          })

          it("should register withdrawable shares", async () => {
            // Withdrawable shares are tracked for receivers, not depositors.
            expect(
              await stbtc.withdrawableShares(depositor1.address),
              "invalid withdrawable shares for depositor 1",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(depositor2.address),
              "invalid withdrawable shares for depositor 2",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(depositor3.address),
              "invalid withdrawable shares for depositor 3",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(sharesOwner1.address),
              "invalid withdrawable shares for receiver 1",
            ).to.be.equal(expectedSharesAmount1)

            expect(
              await stbtc.withdrawableShares(sharesOwner2.address),
              "invalid withdrawable shares for receiver 2",
            ).to.be.equal(expectedSharesAmount2)

            expect(
              await stbtc.withdrawableShares(sharesOwner3.address),
              "invalid withdrawable shares for receiver 3",
            ).to.be.equal(mintAmount3)
          })
        })

        describe("when non fungible withdrawals are disabled", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await stbtc.connect(governance).disableNonFungibleWithdrawals()

            await setupDeposits()
          })

          it("should not register withdrawable shares", async () => {
            expect(
              await stbtc.withdrawableShares(depositor1.address),
              "invalid withdrawable shares for depositor 1",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(depositor2.address),
              "invalid withdrawable shares for depositor 2",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(depositor3.address),
              "invalid withdrawable shares for depositor 3",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(sharesOwner1.address),
              "invalid withdrawable shares for receiver 1",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(sharesOwner2.address),
              "invalid withdrawable shares for receiver 2",
            ).to.be.equal(0)

            expect(
              await stbtc.withdrawableShares(sharesOwner3.address),
              "invalid withdrawable shares for receiver 3",
            ).to.be.equal(0)
          })
        })
      })

      describe("withdraw and redeem", () => {
        beforeAfterSnapshotWrapper()

        let withdrawalReceiver1: HardhatEthersSigner

        before(() => {
          withdrawalReceiver1 = ethers.Wallet.createRandom()
        })

        describe("when non fungible withdrawals are enabled", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await setupDeposits()
          })

          describe("redeem", () => {
            beforeAfterSnapshotWrapper()

            describe("when redeeming partially", () => {
              beforeAfterSnapshotWrapper()

              const redeemSharesAmount1 = to1e18(2)
              /**
               * The amount of assets the receiver will still have in the vault
               * after the first redeem.
               */
              const expectedSharesAmountLeft =
                expectedSharesAmount1 - redeemSharesAmount1

              it("should update withdrawable shares", async () => {
                await stbtc
                  .connect(sharesOwner1)
                  .redeem(
                    redeemSharesAmount1,
                    withdrawalReceiver1.address,
                    sharesOwner1.address,
                  )

                expect(
                  await stbtc.balanceOf(sharesOwner1.address),
                  "invalid balance after redeem 1",
                ).to.be.equal(expectedSharesAmountLeft)

                expect(
                  await stbtc.withdrawableShares(sharesOwner1.address),
                  "invalid withdrawable shares after redeem 1",
                ).to.be.equal(expectedSharesAmountLeft)
              })

              describe("when redeeming fully", () => {
                beforeAfterSnapshotWrapper()

                it("should update withdrawable shares", async () => {
                  await stbtc
                    .connect(sharesOwner1)
                    .redeem(
                      expectedSharesAmountLeft,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    )

                  expect(
                    await stbtc.balanceOf(sharesOwner1.address),
                    "invalid balance after redeem 2",
                  ).to.be.equal(0)

                  expect(
                    await stbtc.withdrawableShares(sharesOwner1.address),
                    "invalid withdrawable shares after redeem 2",
                  ).to.be.equal(0)

                  // The other receiver should still have withdrawable shares.
                  expect(
                    await stbtc.withdrawableShares(sharesOwner2.address),
                    "invalid withdrawable shares after redeem 2 for the other holder",
                  ).to.be.equal(expectedSharesAmount2)
                })
              })
            })

            describe("when redeeming more than registered withdrawable shares", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                // Transfer some shares to the first receiver.
                await stbtc
                  .connect(sharesOwner2)
                  .transfer(sharesOwner1.address, 100)
              })

              it("should revert", async () => {
                await expect(
                  stbtc
                    .connect(sharesOwner1)
                    .redeem(
                      expectedSharesAmount1 + 1n,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    ),
                )
                  .to.be.revertedWithCustomError(
                    stbtc,
                    "ERC4626ExceededMaxRedeem",
                  )
                  .withArgs(
                    sharesOwner1.address,
                    expectedSharesAmount1 + 1n,
                    expectedSharesAmount1,
                  )
              })
            })
          })

          describe("withdraw", () => {
            beforeAfterSnapshotWrapper()

            describe("when withdrawing partially", () => {
              beforeAfterSnapshotWrapper()

              const withdrawAmount1 = to1e18(1)
              /**
               * The amount of assets the receiver will withdraw including the fee
               * added on top of the requested raw withdraw amount.
               */
              const withdrawAmountGross1 =
                withdrawAmount1 + feeOnRaw(withdrawAmount1, exitFeeBasisPoints)

              let expectedSharesAmountLeft: bigint
              let withdrawAmount2: bigint

              before(async () => {
                expectedSharesAmountLeft =
                  expectedSharesAmount1 -
                  (await stbtc.convertToShares(withdrawAmountGross1)) -
                  1n

                withdrawAmount2 = await stbtc.convertToAssets(
                  expectedSharesAmountLeft -
                    feeOnTotal(expectedSharesAmountLeft, exitFeeBasisPoints),
                )
              })

              it("should update withdrawable shares", async () => {
                await stbtc
                  .connect(sharesOwner1)
                  .withdraw(
                    withdrawAmount1,
                    withdrawalReceiver1.address,
                    sharesOwner1.address,
                  )

                expect(
                  await stbtc.balanceOf(sharesOwner1.address),
                  "invalid balance after withdraw 1",
                ).to.be.equal(expectedSharesAmountLeft)

                expect(
                  await stbtc.withdrawableShares(sharesOwner1.address),
                  "invalid withdrawable shares after withdraw 1",
                ).to.be.equal(expectedSharesAmountLeft)
              })

              describe("when withdrawing fully", () => {
                beforeAfterSnapshotWrapper()

                it("should update withdrawable shares", async () => {
                  await stbtc
                    .connect(sharesOwner1)
                    .withdraw(
                      withdrawAmount2,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    )

                  expect(
                    await stbtc.balanceOf(sharesOwner1.address),
                    "invalid balance after withdraw 2",
                  ).to.be.equal(0)

                  expect(
                    await stbtc.withdrawableShares(sharesOwner1.address),
                    "invalid withdrawable shares after withdraw 2",
                  ).to.be.equal(0)

                  // The other receiver should still have withdrawable shares.
                  expect(
                    await stbtc.withdrawableShares(sharesOwner2.address),
                    "invalid withdrawable shares after withdraw 2 for the other holder",
                  ).to.be.equal(expectedSharesAmount2)
                })
              })
            })

            describe("when withdrawing more than registered withdrawable shares", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                // Transfer some shares to the first receiver.
                await stbtc
                  .connect(sharesOwner2)
                  .transfer(sharesOwner1.address, 100)
              })

              it("should revert", async () => {
                const assetsAmount = await stbtc.convertToAssets(
                  expectedSharesAmount1,
                )

                const withdrawalAmount = await stbtc.previewRedeem(
                  expectedSharesAmount1 + 100n,
                )

                const expectedMaxWithdrawal =
                  assetsAmount - feeOnTotal(assetsAmount, exitFeeBasisPoints)

                await expect(
                  stbtc
                    .connect(sharesOwner1)
                    .withdraw(
                      withdrawalAmount,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    ),
                )
                  .to.be.revertedWithCustomError(
                    stbtc,
                    "ERC4626ExceededMaxWithdraw",
                  )
                  .withArgs(
                    sharesOwner1.address,
                    withdrawalAmount,
                    expectedMaxWithdrawal,
                  )
              })
            })
          })
        })

        describe("when non fungible withdrawals are disabled", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            // Initiate the state with enabled non-fungible withdrawals.
            await setupDeposits()

            // Disable the non-fungible withdrawals after the initial deposits
            // were made.
            await stbtc.connect(governance).disableNonFungibleWithdrawals()
          })

          describe("redeem", () => {
            beforeAfterSnapshotWrapper()

            describe("when redeeming partially", () => {
              beforeAfterSnapshotWrapper()

              const redeemSharesAmount1 = to1e18(2)
              const redeemSharesAmount2 =
                expectedSharesAmount1 - redeemSharesAmount1

              it("should update withdrawable shares", async () => {
                await stbtc
                  .connect(sharesOwner1)
                  .redeem(
                    redeemSharesAmount1,
                    withdrawalReceiver1.address,
                    sharesOwner1.address,
                  )

                expect(
                  await stbtc.balanceOf(sharesOwner1.address),
                  "invalid balance after redeem 1",
                ).to.be.equal(redeemSharesAmount2)

                expect(
                  await stbtc.withdrawableShares(sharesOwner1.address),
                  "invalid withdrawable shares after redeem 1",
                ).to.be.equal(expectedSharesAmount1)
              })
            })

            describe("when redeeming more than registered withdrawable shares", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                await stbtc
                  .connect(sharesOwner2)
                  .transfer(sharesOwner1.address, 100)
              })

              it("should not revert", async () => {
                await expect(
                  stbtc
                    .connect(sharesOwner1)
                    .redeem(
                      expectedSharesAmount1 + 100n,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    ),
                ).to.be.not.reverted
              })
            })
          })

          describe("withdraw", () => {
            beforeAfterSnapshotWrapper()

            describe("when withdrawing partially", () => {
              beforeAfterSnapshotWrapper()

              const withdrawAmount1 = to1e18(1)
              const withdrawAmountGross1 =
                withdrawAmount1 + feeOnRaw(withdrawAmount1, exitFeeBasisPoints)

              let expectedSharesAmountLeft: bigint

              before(async () => {
                expectedSharesAmountLeft =
                  expectedSharesAmount1 -
                  (await stbtc.convertToShares(withdrawAmountGross1)) -
                  1n
              })

              it("should update withdrawable shares", async () => {
                await stbtc
                  .connect(sharesOwner1)
                  .withdraw(
                    withdrawAmount1,
                    withdrawalReceiver1.address,
                    sharesOwner1.address,
                  )

                expect(
                  await stbtc.balanceOf(sharesOwner1.address),
                  "invalid balance after withdraw 1",
                ).to.be.equal(expectedSharesAmountLeft)

                expect(
                  await stbtc.withdrawableShares(sharesOwner1.address),
                  "invalid withdrawable shares after withdraw 1",
                ).to.be.equal(expectedSharesAmount1)
              })
            })

            describe("when withdrawing more than registered withdrawable shares", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                await stbtc
                  .connect(sharesOwner2)
                  .transfer(sharesOwner1.address, 100)
              })

              it("should not revert", async () => {
                const withdrawalAmount = await stbtc.previewRedeem(
                  expectedSharesAmount1 + 100n,
                )

                await expect(
                  stbtc
                    .connect(sharesOwner1)
                    .withdraw(
                      withdrawalAmount,
                      withdrawalReceiver1.address,
                      sharesOwner1.address,
                    ),
                ).to.be.not.reverted
              })
            })
          })
        })
      })

      describe("maxWithdraw and maxRedeem", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await setupDeposits()

          // Transfer shares from the second receiver to the first receiver.
          // This changes shares balance, but doesn't affect registered withdrawable
          // shares mapping.
          await stbtc
            .connect(sharesOwner2)
            .transfer(sharesOwner1.address, expectedSharesAmount2)
        })

        describe("when non fungible withdrawals are enabled", () => {
          describe("maxRedeem", () => {
            it("should return the correct amount", async () => {
              const actual = await stbtc.maxRedeem(sharesOwner1.address)

              // Only shares that were initially minted for the first receiver.
              const expected = expectedSharesAmount1

              expect(actual).to.be.equal(expected)
            })
          })

          describe("maxWithdraw", () => {
            it("should return the correct amount", async () => {
              const actual = await stbtc.maxWithdraw(sharesOwner1.address)

              // Includes only shares that were initially minted for the first receiver.
              const assets = await stbtc.convertToAssets(expectedSharesAmount1)
              const expected = assets - feeOnTotal(assets, exitFeeBasisPoints)

              expect(actual).to.be.equal(expected)
            })
          })
        })

        describe("when non fungible withdrawals are disabled", () => {
          before(async () => {
            await stbtc.connect(governance).disableNonFungibleWithdrawals()
          })

          describe("maxRedeem", () => {
            it("should return the correct amount", async () => {
              const actual = await stbtc.maxRedeem(sharesOwner1.address)

              // Includes additional shares that were transferred from the second receiver.
              const expected = expectedSharesAmount1 + expectedSharesAmount2

              expect(actual).to.be.equal(expected)
            })
          })

          describe("maxWithdraw", () => {
            it("should return the correct amount", async () => {
              const actual = await stbtc.maxWithdraw(sharesOwner1.address)

              // Includes additional shares that were transferred from the second receiver.
              const assets = await stbtc.convertToAssets(
                expectedSharesAmount1 + expectedSharesAmount2,
              )

              const expected = assets - feeOnTotal(assets, exitFeeBasisPoints)

              expect(actual).to.be.equal(expected)
            })
          })
        })
      })
    })
  })

  describe("mintDebt and repayDebt", () => {
    beforeAfterSnapshotWrapper()

    describe("updateDebtAllowance", () => {
      beforeAfterSnapshotWrapper()

      describe("when caller is not governance", () => {
        it("should revert", async () => {
          await expect(
            stbtc
              .connect(thirdParty)
              .updateDebtAllowance(externalMinter.address, to1e18(1)),
          )
            .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
            .withArgs(thirdParty.address)
        })
      })

      describe("when caller is governance", () => {
        describe("when allowed debt is zero", () => {
          beforeAfterSnapshotWrapper()

          testupdateDebtAllowance(to1e18(100))
        })

        describe("when allowed debt is non-zero", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await stbtc
              .connect(governance)
              .updateDebtAllowance(externalMinter.address, to1e18(1))
          })

          describe("when changing the debt allowance to non-zero value", () => {
            beforeAfterSnapshotWrapper()

            testupdateDebtAllowance(to1e18(100))
          })

          describe("when changing the debt allowance to zero value", () => {
            beforeAfterSnapshotWrapper()

            testupdateDebtAllowance(to1e18(0))
          })
        })

        function testupdateDebtAllowance(newDebtAllowance: bigint) {
          let tx: ContractTransactionResponse

          before(async () => {
            tx = await stbtc
              .connect(governance)
              .updateDebtAllowance(externalMinter.address, newDebtAllowance)
          })

          it("should set the new debt allowance", async () => {
            expect(await stbtc.allowedDebt(externalMinter.address)).to.be.eq(
              newDebtAllowance,
            )
          })

          it("should emit DebtAllowanceUpdated event", async () => {
            await expect(tx)
              .to.emit(stbtc, "DebtAllowanceUpdated")
              .withArgs(externalMinter.address, newDebtAllowance)
          })
        }
      })
    })

    describe("mintDebt", () => {
      beforeAfterSnapshotWrapper()

      describe("when paused", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await stbtc.connect(governance).pause()
        })

        it("should revert", async () => {
          await expect(
            stbtc.connect(thirdParty).mintDebt(to1e18(1), sharesOwner1.address),
          ).to.be.revertedWithCustomError(stbtc, "EnforcedPause")
        })
      })

      describe("when not paused", () => {
        beforeAfterSnapshotWrapper()

        describe("when not allowed", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            await expect(
              stbtc
                .connect(thirdParty)
                .mintDebt(to1e18(1), sharesOwner1.address),
            )
              .to.be.revertedWithCustomError(stbtc, "InsufficientDebtAllowance")
              .withArgs(thirdParty.address, 0, to1e18(1))
          })
        })

        describe("when allowed", () => {
          beforeAfterSnapshotWrapper()

          const debtAllowance = to1e18(100)

          before(async () => {
            await stbtc
              .connect(governance)
              .updateDebtAllowance(externalMinter.address, debtAllowance)
          })

          describe("on empty vault", () => {
            beforeAfterSnapshotWrapper()

            const newDebtShares = to1e18(10)

            testMintDebt(
              () => sharesOwner1.address,
              newDebtShares,
              newDebtShares,
            )
          })

          describe("when the vault is not empty", () => {
            describe("when there is debt already minted", () => {
              beforeAfterSnapshotWrapper()

              // amount of shares minted equals the amount of assets taken
              // as a debt in this case so we can assume 1:1 conversion
              const existingMintedDebt = to1e18(23)

              before(async () => {
                await stbtc
                  .connect(externalMinter)
                  .mintDebt(existingMintedDebt, sharesOwner2.address)
              })

              describe("when requested debt exceeds the allowance", () => {
                beforeAfterSnapshotWrapper()

                it("should revert", async () => {
                  const requestedDebt = debtAllowance - existingMintedDebt + 1n
                  const expectedDebt = existingMintedDebt + requestedDebt

                  await expect(
                    stbtc
                      .connect(externalMinter)
                      .mintDebt(requestedDebt, sharesOwner1.address),
                  )
                    .to.be.revertedWithCustomError(
                      stbtc,
                      "InsufficientDebtAllowance",
                    )
                    .withArgs(
                      externalMinter.address,
                      debtAllowance,
                      expectedDebt,
                    )
                })
              })

              describe("when requested debt does not exceed the allowance", () => {
                beforeAfterSnapshotWrapper()

                const newDebtShares = to1e18(10)

                testMintDebt(
                  () => sharesOwner1.address,
                  newDebtShares,
                  newDebtShares,
                )
              })
            })

            describe("when there are deposits already made", () => {
              beforeAfterSnapshotWrapper()

              const existingDepositedAssets = to1e18(24)
              // Calculate amount of assets to deposit, including the entry fee,
              // so as a result the vault will have the expected amount of assets.
              const assetsToDeposit =
                existingDepositedAssets +
                feeOnRaw(existingDepositedAssets, entryFeeBasisPoints)

              before(async () => {
                await tbtc
                  .connect(depositor1)
                  .approve(await stbtc.getAddress(), assetsToDeposit)

                await stbtc
                  .connect(depositor1)
                  .deposit(assetsToDeposit, sharesOwner2.address)
              })

              describe("when requested debt exceeds the allowance", () => {
                beforeAfterSnapshotWrapper()

                const requestedShares = debtAllowance + 1n

                it("should revert", async () => {
                  await expect(
                    stbtc
                      .connect(externalMinter)
                      .mintDebt(requestedShares, sharesOwner1.address),
                  )
                    .to.be.revertedWithCustomError(
                      stbtc,
                      "InsufficientDebtAllowance",
                    )
                    .withArgs(
                      externalMinter.address,
                      debtAllowance,
                      requestedShares,
                    )
                })
              })

              describe("when requested debt does not exceed the allowance", () => {
                beforeAfterSnapshotWrapper()

                const newDebtShares = to1e18(12)

                describe("when there is no yield generated", () => {
                  beforeAfterSnapshotWrapper()

                  testMintDebt(
                    () => sharesOwner1.address,
                    newDebtShares,
                    newDebtShares,
                  )
                })

                describe("when there is yield generated", () => {
                  beforeAfterSnapshotWrapper()

                  // Initial state:
                  //   Deposited assets: 24
                  //   Debt: 0
                  //   Yield: 6
                  // New mint:
                  //   Shares: 12
                  //   Expected debt: 12 * (24 + 6) / 24 = 15

                  const earnedYield = to1e18(6)

                  // assets = shares * total assets / total supply
                  // the -1n comes from convertToAssets implementation in
                  // ERC4626Upgradeable
                  const expectedDebt = to1e18(15) - 1n

                  before(async () => {
                    await tbtc.mint(await stbtc.getAddress(), earnedYield)
                  })

                  testMintDebt(
                    () => sharesOwner1.address,
                    newDebtShares,
                    expectedDebt,
                  )
                })
              })
            })
          })
        })

        describe("when there are two minters", () => {
          beforeAfterSnapshotWrapper()

          const minter1DebtAllowance = to1e18(100)
          const minter1Shares = to1e18(10)

          const minter2DebtAllowance = to1e18(120)
          const minter2Shares = to1e18(110)

          let minter1: HardhatEthersSigner
          let minter2: HardhatEthersSigner

          before(async () => {
            minter1 = externalMinter
            minter2 = thirdParty

            await stbtc
              .connect(governance)
              .updateDebtAllowance(minter1.address, minter1DebtAllowance)

            await stbtc
              .connect(governance)
              .updateDebtAllowance(minter2.address, minter2DebtAllowance)
          })

          testMintDebt(
            () => sharesOwner1.address,
            minter1Shares,
            minter1Shares,
            () => minter1,
            "test mint debt for minter 1",
          )

          testMintDebt(
            () => sharesOwner2.address,
            minter2Shares,
            minter2Shares,
            () => minter2,
            "test mint debt for minter 2",
          )

          describe("test results after two debt mints", () => {
            it("should sum up the total debt", async () => {
              expect(await stbtc.totalDebt()).to.be.eq(
                minter1Shares + minter2Shares,
              )
            })
          })
        })
      })

      function testMintDebt(
        getReceiver: () => string,
        newShares: bigint,
        expectedNewDebt: bigint,
        getMinter: () => HardhatEthersSigner = () => externalMinter,
        testDescription = "test mint debt for minter",
      ) {
        describe(testDescription, () => {
          let minter: HardhatEthersSigner
          let receiverAddress: string
          let initialCurrentDebt: bigint
          let initialTotalDebt: bigint
          let initialTotalSupply: bigint
          let initialTotalAssets: bigint
          let tx: ContractTransactionResponse

          before(async () => {
            minter = getMinter()
            receiverAddress = getReceiver()

            initialCurrentDebt = await stbtc.currentDebt(minter.address)
            initialTotalDebt = await stbtc.totalDebt()
            initialTotalSupply = await stbtc.totalSupply()
            initialTotalAssets = await stbtc.totalAssets()

            tx = await stbtc
              .connect(minter)
              .mintDebt(newShares, receiverAddress)
          })

          it("should transfer stBTC to the receiver", async () => {
            await expect(tx).to.changeTokenBalances(
              stbtc,
              [receiverAddress],
              [newShares],
            )
          })

          it("should not set current debt for the receiver", async () => {
            expect(await stbtc.currentDebt(receiverAddress)).to.be.eq(0)
          })

          it("should increase current debt for the minter", async () => {
            expect(await stbtc.currentDebt(minter.address)).to.be.eq(
              initialCurrentDebt + expectedNewDebt,
            )
          })

          it("should increase total debt", async () => {
            expect(await stbtc.totalDebt()).to.be.eq(
              initialTotalDebt + expectedNewDebt,
            )
          })

          it("should increase total supply", async () => {
            expect(await stbtc.totalSupply()).to.be.eq(
              initialTotalSupply + newShares,
            )
          })

          it("should increase total assets", async () => {
            expect(await stbtc.totalAssets()).to.be.eq(
              initialTotalAssets + expectedNewDebt,
            )
          })

          it("should emit DebtMinted event", async () => {
            await expect(tx)
              .to.emit(stbtc, "DebtMinted")
              .withArgs(
                minter.address,
                initialCurrentDebt + expectedNewDebt,
                expectedNewDebt,
                newShares,
              )
          })
        })
      }
    })

    describe("repayDebt", () => {
      beforeAfterSnapshotWrapper()

      describe("when paused", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await stbtc.connect(governance).pause()
        })

        it("should revert", async () => {
          await expect(
            stbtc.connect(thirdParty).repayDebt(to1e18(1)),
          ).to.be.revertedWithCustomError(stbtc, "EnforcedPause")
        })
      })

      describe("when not paused", () => {
        beforeAfterSnapshotWrapper()

        describe("with no current debt", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            await expect(stbtc.connect(thirdParty).repayDebt(to1e18(1)))
              .to.be.revertedWithCustomError(stbtc, "ExcessiveDebtRepayment")
              .withArgs(thirdParty.address, 0, to1e18(1))
          })
        })

        describe("when there is debt already minted", () => {
          beforeAfterSnapshotWrapper()

          const existingDebt = to1e18(12)

          before(async () => {
            await stbtc
              .connect(governance)
              .updateDebtAllowance(externalMinter.address, existingDebt)
            // amount of shares minted equals the amount of assets taken
            // as a debt in this case so we can assume 1:1 conversion
            const sharesToMint = existingDebt
            await stbtc
              .connect(externalMinter)
              .mintDebt(sharesToMint, sharesOwner1.address)
          })

          describe("when called by shares owner", () => {
            beforeAfterSnapshotWrapper()

            it("should revert", async () => {
              await expect(stbtc.connect(sharesOwner1).repayDebt(existingDebt))
                .to.be.revertedWithCustomError(stbtc, "ExcessiveDebtRepayment")
                .withArgs(sharesOwner1.address, 0, existingDebt)
            })
          })

          describe("when called by debt minter", () => {
            describe("when the requested debt repayment is greater than the current debt", () => {
              beforeAfterSnapshotWrapper()

              it("should revert", async () => {
                const requestedAmount = existingDebt + 1n
                await expect(
                  stbtc.connect(externalMinter).repayDebt(requestedAmount),
                )
                  .to.be.revertedWithCustomError(
                    stbtc,
                    "ExcessiveDebtRepayment",
                  )
                  .withArgs(
                    externalMinter.address,
                    existingDebt,
                    requestedAmount,
                  )
              })
            })

            describe("when the requested debt repayment is same as the current debt", () => {
              beforeAfterSnapshotWrapper()

              before(async () => {
                await stbtc
                  .connect(sharesOwner1)
                  .transfer(externalMinter.address, existingDebt)
              })

              testRepayDebt(existingDebt, existingDebt)
            })

            describe("when the requested debt is less than the current debt", () => {
              describe("when debt minter doesn't have enough shares", () => {
                beforeAfterSnapshotWrapper()

                const requestedRepayAmount = to1e18(5)
                const sharesBalance = requestedRepayAmount - 1n

                before(async () => {
                  await stbtc
                    .connect(sharesOwner1)
                    .transfer(externalMinter.address, sharesBalance)
                })

                it("should revert", async () => {
                  await expect(
                    stbtc
                      .connect(externalMinter)
                      .repayDebt(requestedRepayAmount),
                  )
                    .to.be.revertedWithCustomError(
                      stbtc,
                      "ERC20InsufficientBalance",
                    )
                    .withArgs(
                      externalMinter.address,
                      sharesBalance,
                      requestedRepayAmount,
                    )
                })
              })

              describe("when debt minter has enough shares", () => {
                beforeAfterSnapshotWrapper()

                const requestedRepayAmount = to1e18(6)

                before(async () => {
                  await stbtc
                    .connect(sharesOwner1)
                    .transfer(externalMinter.address, requestedRepayAmount)
                })

                describe("when there is no deposits", () => {
                  beforeAfterSnapshotWrapper()

                  before(async () => {
                    await stbtc
                      .connect(sharesOwner1)
                      .transfer(externalMinter.address, requestedRepayAmount)
                  })

                  testRepayDebt(requestedRepayAmount, requestedRepayAmount)
                })

                describe("when there are deposits already made", () => {
                  beforeAfterSnapshotWrapper()

                  const existingDepositedAssets = to1e18(24)
                  // Calculate amount of assets to deposit, including the entry fee,
                  // so as a result the vault will have the expected amount of assets.
                  const assetsToDeposit =
                    existingDepositedAssets +
                    feeOnRaw(existingDepositedAssets, entryFeeBasisPoints)

                  before(async () => {
                    await tbtc
                      .connect(depositor1)
                      .approve(await stbtc.getAddress(), assetsToDeposit)

                    await stbtc
                      .connect(depositor1)
                      .deposit(assetsToDeposit, sharesOwner2.address)
                  })

                  describe("when there is no yield generated", () => {
                    beforeAfterSnapshotWrapper()

                    testRepayDebt(requestedRepayAmount, requestedRepayAmount)
                  })

                  describe("when there is yield generated", () => {
                    beforeAfterSnapshotWrapper()

                    // Initial state:
                    //   Deposited assets: 24
                    //   Debt: 10
                    //   Yield: 6
                    // Repayment:
                    //   Shares: 6
                    //   Expected asset repayment: 6 * (24 + 10 + 6) / (24 + 10) = ~7

                    const earnedYield = to1e18(6)

                    // assets = shares * total assets / total supply
                    // see the rounding in _convertToAssets
                    const expectedDebtRepay = to1e18(7) - 1n

                    before(async () => {
                      await tbtc.mint(await stbtc.getAddress(), earnedYield)
                    })

                    testRepayDebt(requestedRepayAmount, expectedDebtRepay)
                  })
                })
              })
            })

            function testRepayDebt(
              repaySharesAmount: bigint,
              expectedDebtRepayment: bigint,
            ) {
              let initialCurrentDebt: bigint
              let initialTotalDebt: bigint
              let initialTotalSupply: bigint
              let initialTotalAssets: bigint
              let tx: ContractTransactionResponse

              before(async () => {
                initialCurrentDebt = await stbtc.currentDebt(
                  externalMinter.address,
                )
                initialTotalDebt = await stbtc.totalDebt()
                initialTotalSupply = await stbtc.totalSupply()
                initialTotalAssets = await stbtc.totalAssets()

                tx = await stbtc
                  .connect(externalMinter)
                  .repayDebt(repaySharesAmount)
              })

              it("should transfer stBTC from the debt minter", async () => {
                await expect(tx).to.changeTokenBalances(
                  stbtc,
                  [externalMinter],
                  [-repaySharesAmount],
                )
              })

              it("should decrease current debt for the minter", async () => {
                expect(
                  await stbtc.currentDebt(externalMinter.address),
                ).to.be.eq(initialCurrentDebt - expectedDebtRepayment)
              })

              it("should decrease total debt", async () => {
                expect(await stbtc.totalDebt()).to.be.eq(
                  initialTotalDebt - expectedDebtRepayment,
                )
              })

              it("should decrease total supply", async () => {
                expect(await stbtc.totalSupply()).to.be.eq(
                  initialTotalSupply - repaySharesAmount,
                )
              })

              it("should decrease total assets", async () => {
                expect(await stbtc.totalAssets()).to.be.eq(
                  initialTotalAssets - expectedDebtRepayment,
                )
              })

              it("should emit DebtRepaid event", async () => {
                await expect(tx)
                  .to.emit(stbtc, "DebtRepaid")
                  .withArgs(
                    externalMinter.address,
                    initialCurrentDebt - expectedDebtRepayment,
                    expectedDebtRepayment,
                    repaySharesAmount,
                  )
              })
            }
          })
        })
      })
    })

    describe("round trip", () => {
      // This test covers a roundtrip debt minting and burning with small values
      // to test the solution from external minter perspective and make sure the
      // amounts of assets and shares are converted correctly.

      beforeAfterSnapshotWrapper()

      before(async () => {
        await stbtc.connect(governance).updateEntryFeeBasisPoints(0)
        await stbtc.connect(governance).updateExitFeeBasisPoints(0)

        await stbtc.connect(governance).updateMinimumDepositAmount(1)

        await stbtc
          .connect(governance)
          .updateDebtAllowance(externalMinter.address, 100)
      })

      describe("on empty vault", () => {
        beforeAfterSnapshotWrapper()

        testRoundTrip(
          10n,
          10n,
          { totalAssets: 10n, totalSupply: 10n },
          { totalAssets: 0n, totalSupply: 0n },
        )
      })

      describe("on non-empty vault", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          const existingDeposit = 23n

          await tbtc
            .connect(depositor1)
            .approve(await stbtc.getAddress(), existingDeposit)

          await stbtc
            .connect(depositor1)
            .deposit(existingDeposit, depositor1.address)
        })

        describe("when there is no yield generated", () => {
          beforeAfterSnapshotWrapper()

          testRoundTrip(
            10n,
            10n,
            // totalAssets = 23 + 10 = 33
            // totalSupply = 23 + 10 = 33
            { totalAssets: 33n, totalSupply: 33n },
            // totalAssets = 33 - 10 = 23
            // totalSupply = 33 - 10 = 23
            { totalAssets: 23n, totalSupply: 23n },
          )
        })

        describe("when there is yield generated", () => {
          beforeAfterSnapshotWrapper()

          const yieldAmount = 5n

          before(async () => {
            await tbtc.mint(await stbtc.getAddress(), yieldAmount)
          })

          testRoundTrip(
            10n,
            // 10 * (23 + 5) / 23 = 12
            12n,
            // totalAssets = 23 + 5 + 12 = 40
            // totalSupply = 23 + 10 = 33
            { totalAssets: 40n, totalSupply: 33n },
            // totalAssets = 40 - 12 = 28
            // totalSupply = 33 - 10 = 23
            { totalAssets: 28n, totalSupply: 23n },
          )
        })
      })

      function testRoundTrip(
        shares: bigint,
        expectedDebtAmount: bigint,
        expectedMintDebtResult: {
          totalAssets: bigint
          totalSupply: bigint
        },
        expectedRepayDebtResults: {
          totalAssets: bigint
          totalSupply: bigint
        },
      ) {
        describe("mintDebt", () => {
          let mintDebtTx: ContractTransactionResponse

          before(async () => {
            mintDebtTx = await stbtc
              .connect(externalMinter)
              .mintDebt(shares, externalMinter.address)
          })

          it("should transfer stBTC to the receiver", async () => {
            await expect(mintDebtTx).to.changeTokenBalances(
              stbtc,
              [externalMinter],
              [shares],
            )
          })

          it("should increase total debt", async () => {
            expect(await stbtc.totalDebt()).to.be.eq(expectedDebtAmount)
          })

          it("should increase total assets", async () => {
            expect(await stbtc.totalAssets()).to.be.eq(
              expectedMintDebtResult.totalAssets,
            )
          })

          it("should increase total supply", async () => {
            expect(await stbtc.totalSupply()).to.be.eq(
              expectedMintDebtResult.totalSupply,
            )
          })
        })

        describe("repayDebt", () => {
          let repayDebtTx: ContractTransactionResponse

          before(async () => {
            repayDebtTx = await stbtc.connect(externalMinter).repayDebt(shares)
          })

          it("should transfer stBTC from the debt minter", async () => {
            await expect(repayDebtTx).to.changeTokenBalances(
              stbtc,
              [externalMinter],
              [-shares],
            )
          })

          it("should decrease total debt", async () => {
            expect(await stbtc.totalDebt()).to.be.eq(0)
          })

          it("should decrease total assets", async () => {
            expect(await stbtc.totalAssets()).to.be.eq(
              expectedRepayDebtResults.totalAssets,
            )
          })

          it("should decrease total supply", async () => {
            expect(await stbtc.totalSupply()).to.be.eq(
              expectedRepayDebtResults.totalSupply,
            )
          })
        })
      }
    })
  })

  describe("feeOnTotal - internal test helper", () => {
    context("when the fee's modulo remainder is greater than 0", () => {
      it("should add 1 to the result", () => {
        // feeOnTotal - test's internal function simulating the OZ mulDiv
        // function.
        const fee = feeOnTotal(to1e18(1), entryFeeBasisPoints)
        // fee = (1e18 * 5) / (10000 + 5) = 499750124937531 + 1
        const expectedFee = 499750124937532
        expect(fee).to.be.eq(expectedFee)
      })
    })

    context("when the fee's modulo remainder is equal to 0", () => {
      it("should return the actual result", () => {
        // feeOnTotal - test's internal function simulating the OZ mulDiv
        // function.
        const fee = feeOnTotal(2001n, entryFeeBasisPoints)
        // fee = (2001 * 5) / (10000 + 5) = 1
        const expectedFee = 1n
        expect(fee).to.be.eq(expectedFee)
      })
    })
  })

  describe("feeOnRaw - internal test helper", () => {
    context("when the fee's modulo remainder is greater than 0", () => {
      it("should return the correct amount of fees", () => {
        // feeOnRaw - this is a test internal function
        const fee = feeOnRaw(to1e18(1), entryFeeBasisPoints)
        // fee = (1e18 * 5) / (10000) = 500000000000000
        const expectedFee = 500000000000000
        expect(fee).to.be.eq(expectedFee)
      })
    })

    context("when the fee's modulo remainder is equal to 0", () => {
      it("should return the actual result", () => {
        // feeOnTotal - test's internal function simulating the OZ mulDiv
        // function.
        const fee = feeOnTotal(2000n, entryFeeBasisPoints)
        // fee = (2000 * 5) / 10000 = 1
        const expectedFee = 1n
        expect(fee).to.be.eq(expectedFee)
      })
    })
  })

  describe("migrateDeposit", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not governance", () => {
      beforeAfterSnapshotWrapper()

      it("should revert", async () => {
        await expect(
          stbtc.connect(thirdParty).migrateDeposit(depositor1.address),
        )
          .to.be.revertedWithCustomError(stbtc, "OwnableUnauthorizedAccount")
          .withArgs(thirdParty.address)
      })
    })

    context("when caller is governance", () => {
      beforeAfterSnapshotWrapper()

      const depositAmount = to1e18(10)
      const debtAmount = to1e18(5)

      const expectedDepositAssets =
        depositAmount - feeOnTotal(depositAmount, entryFeeBasisPoints)
      const expectedDepositShares = expectedDepositAssets
      const expectedDebtAssets = debtAmount
      const expectedDebtShares = expectedDebtAssets

      let onlyDebtDepositor: HardhatEthersSigner
      let onlyDepositDepositor: HardhatEthersSigner
      let mixedDepositor: HardhatEthersSigner

      before(async () => {
        onlyDepositDepositor = depositor1
        onlyDebtDepositor = depositor2
        mixedDepositor = depositor3

        // Depositor with only debt shares
        await stbtc
          .connect(governance)
          .updateDebtAllowance(onlyDebtDepositor.address, debtAmount)

        await stbtc
          .connect(onlyDebtDepositor)
          .mintDebt(to1e18(5), onlyDebtDepositor.address)

        // Depositor with only deposit shares
        await tbtc.mint(onlyDepositDepositor.address, depositAmount)
        await tbtc
          .connect(onlyDepositDepositor)
          .approve(await stbtc.getAddress(), depositAmount)

        await stbtc
          .connect(onlyDepositDepositor)
          .deposit(depositAmount, onlyDepositDepositor.address)

        // Depositor with mixed shares
        await tbtc.mint(mixedDepositor.address, depositAmount)
        await tbtc
          .connect(mixedDepositor)
          .approve(await stbtc.getAddress(), depositAmount)

        await stbtc
          .connect(mixedDepositor)
          .deposit(depositAmount, mixedDepositor.address)

        await stbtc
          .connect(governance)
          .updateDebtAllowance(mixedDepositor.address, debtAmount)

        await stbtc
          .connect(mixedDepositor)
          .mintDebt(debtAmount, mixedDepositor.address)
      })

      context("when contract is paused", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          const newVault = await ethers.Wallet.createRandom().getAddress()
          await stbtc.connect(governance).startMigration(newVault)
          await stbtc.connect(pauseAdmin).pause()
        })

        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).migrateDeposit(depositor1.address),
          ).to.be.revertedWithCustomError(stbtc, "EnforcedPause")
        })
      })

      context("when migration has not started", () => {
        it("should revert", async () => {
          await expect(
            stbtc.connect(governance).migrateDeposit(depositor1.address),
          ).to.be.revertedWithCustomError(stbtc, "MigrateToNotSet")
        })
      })

      context("when migration has started", () => {
        beforeAfterSnapshotWrapper()

        let newVault: string

        before(async () => {
          newVault = await acreBtc.getAddress()
          await stbtc.connect(governance).startMigration(newVault)
        })

        context("when depositor has no shares", () => {
          it("should return 0 and not perform migration", async () => {
            const result = await stbtc
              .connect(governance)
              .migrateDeposit.staticCall(thirdParty.address)
            expect(result).to.equal(0)
          })
        })

        context("when depositor has only debt shares", () => {
          beforeAfterSnapshotWrapper()

          it("should return 0 as no withdrawable shares exist", async () => {
            const result = await stbtc
              .connect(governance)
              .migrateDeposit.staticCall(onlyDebtDepositor.address)
            expect(result).to.equal(0)
          })
        })

        context("when depositor has regular deposit shares", () => {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await stbtc
              .connect(governance)
              .migrateDeposit(onlyDepositDepositor.address)
          })

          it("should burn all shares from depositor", async () => {
            await expect(tx).to.changeTokenBalances(
              stbtc,
              [onlyDepositDepositor.address],
              [-expectedDepositShares],
            )
          })

          it("should reset withdrawable shares to 0", async () => {
            expect(
              await stbtc.withdrawableShares(onlyDepositDepositor.address),
            ).to.equal(0)
          })

          it("should return the expected shares amount", async () => {
            const result = await stbtc
              .connect(governance)
              .migrateDeposit.staticCall(onlyDepositDepositor.address)
            expect(result).to.equal(0) // Returns 0 because shares were already migrated
          })

          it("should emit a DepositMigrated event", async () => {
            await expect(tx)
              .to.emit(stbtc, "DepositMigrated")
              .withArgs(
                onlyDepositDepositor.address,
                expectedDepositAssets,
                expectedDepositShares,
                expectedDepositShares,
              )
          })
        })

        context("when depositor has mixed shares (regular + debt)", () => {
          beforeAfterSnapshotWrapper()

          let tx: ContractTransactionResponse

          before(async () => {
            tx = await stbtc
              .connect(governance)
              .migrateDeposit(mixedDepositor.address)
          })

          it("should only burn withdrawable shares", async () => {
            await expect(tx).to.changeTokenBalances(
              stbtc,
              [mixedDepositor.address],
              [-expectedDepositShares],
            )
          })

          it("should leave debt shares intact", async () => {
            const remainingShares = await stbtc.balanceOf(
              mixedDepositor.address,
            )
            expect(remainingShares).to.equal(expectedDebtShares)
          })

          it("should reset withdrawable shares to 0", async () => {
            expect(
              await stbtc.withdrawableShares(mixedDepositor.address),
            ).to.equal(0)
          })

          it("should preserve debt amount", async () => {
            expect(await stbtc.currentDebt(mixedDepositor.address)).to.equal(
              debtAmount,
            )
          })

          it("should emit a DepositMigrated event", async () => {
            await expect(tx)
              .to.emit(stbtc, "DepositMigrated")
              .withArgs(
                mixedDepositor.address,
                expectedDepositAssets,
                expectedDepositShares,
                expectedDepositShares,
              )
          })
        })
      })
    })
  })

  // 10 is added or subtracted to/from the expected value to match the Solidity
  // math which rounds up or down depending on the modulo remainder. It is a very
  // small number.
  function expectCloseTo(actual: bigint, expected: bigint) {
    return expect(actual, "invalid asset balance").to.be.closeTo(expected, 10n)
  }
})
