import {
  takeSnapshot,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ContractTransactionResponse, MaxUint256, ZeroAddress } from "ethers"
import { ethers, helpers, upgrades } from "hardhat"

import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import type { SnapshotRestorer } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"

import { to1e18, feeOnTotal, feeOnRaw } from "./utils"

import {
  AcreBTC as acreBTC,
  TestERC20,
  type AcreBTC,
  type MidasAllocator,
  type WithdrawalQueue,
} from "../typechain"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { tbtc, acreBtc, midasAllocator, withdrawalQueue } = await deployment()
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
    caller,
  ] = await getUnnamedSigners()

  const amountToMint = to1e18(100000)
  await tbtc.mint(depositor1, amountToMint)
  await tbtc.mint(depositor2, amountToMint)
  await tbtc.mint(depositor3, amountToMint)

  return {
    acreBtc,
    tbtc,
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
    midasAllocator,
    pauseAdmin,
    maintainer,
    withdrawalQueue,
    caller,
  }
}

describe("acreBTC", () => {
  const entryFeeBasisPoints = 5n // Used only for the tests.
  const exitFeeBasisPoints = 10n // Used only for the tests.

  let acreBtc: acreBTC
  let tbtc: TestERC20
  let midasAllocator: MidasAllocator
  let withdrawalQueue: WithdrawalQueue

  let governance: HardhatEthersSigner
  let depositor1: HardhatEthersSigner
  let depositor2: HardhatEthersSigner

  let thirdParty: HardhatEthersSigner
  let caller: HardhatEthersSigner
  let treasury: HardhatEthersSigner
  let pauseAdmin: HardhatEthersSigner
  let maintainer: HardhatEthersSigner

  before(async () => {
    ;({
      acreBtc,
      tbtc,
      acreBtc,
      depositor1,
      depositor2,
      governance,
      thirdParty,
      treasury,
      midasAllocator,
      pauseAdmin,
      maintainer,
      caller,
      withdrawalQueue,
    } = await loadFixture(fixture))

    await acreBtc
      .connect(governance)
      .updateEntryFeeBasisPoints(entryFeeBasisPoints)

    await acreBtc
      .connect(governance)
      .updateExitFeeBasisPoints(exitFeeBasisPoints)
  })

  describe("previewDeposit", () => {
    beforeAfterSnapshotWrapper()

    context("when the vault is empty", () => {
      const amountToDeposit = to1e18(1)

      before(async () => {
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)
      })

      context("when validating preview deposit against hardcoded value", () => {
        it("should return the correct amount of shares", async () => {
          const shares = await acreBtc.previewDeposit(amountToDeposit)
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
            const shares = await acreBtc.previewDeposit(amountToDeposit)
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
          .approve(await acreBtc.getAddress(), amountToDeposit1)

        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit1, depositor1.address)
      })

      it("should return the correct amount of shares", async () => {
        const expectedShares =
          amountToDeposit2 - feeOnTotal(amountToDeposit2, entryFeeBasisPoints)
        const shares = await acreBtc.previewDeposit(amountToDeposit2)
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
        expect(await acreBtc.previewRedeem(toRedeem)).to.be.equal(
          expectedShares,
        )
      })
    })

    context("when the vault is not empty", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(1)

      before(async () => {
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)

        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
      })

      context("when there is no yield generated", () => {
        it("should return the correct amount of assets", async () => {
          const shares = await acreBtc.balanceOf(depositor1.address)
          // Preview redeem on already deposited amount for which entry fee was
          // taken.
          const availableAssetsToRedeem = await acreBtc.previewRedeem(shares)
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
          await tbtc.mint(await acreBtc.getAddress(), earnedYield)
        })

        it("should return the correct amount of assets", async () => {
          const shares = await acreBtc.balanceOf(depositor1.address)
          const availableAssetsToRedeem = await acreBtc.previewRedeem(shares)
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

        const assetsToDeposit = await acreBtc.previewMint(to1e18(1))
        expect(assetsToDeposit).to.be.eq(amountToDeposit)
      })
    })

    context(
      "when validating preview mint against programatically calculated value",
      () => {
        context("when the vault is not empty", () => {
          const sharesToMint1 = to1e18(1)
          const sharesToMint2 = to1e18(2)

          // To receive 1 acreBTC, a user must deposit 1.0005 tBTC where 0.0005 tBTC
          // is a fee.
          const amountToDeposit1 =
            sharesToMint1 + feeOnRaw(sharesToMint1, entryFeeBasisPoints)

          // To receive 2 acreBTC, a user must deposit 2.001 tBTC where 0.001 tBTC
          // is a fee.
          const amountToDeposit2 =
            sharesToMint2 + feeOnRaw(sharesToMint2, entryFeeBasisPoints)

          it("should preview the correct amount of assets for deposit 2", async () => {
            await tbtc
              .connect(depositor1)
              .approve(await acreBtc.getAddress(), amountToDeposit1)

            await tbtc
              .connect(depositor2)
              .approve(await acreBtc.getAddress(), amountToDeposit2)

            await acreBtc
              .connect(depositor1)
              .mint(sharesToMint1, depositor1.address)

            const assets = await acreBtc.previewMint(sharesToMint2)
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
        expect(await acreBtc.assetsBalanceOf(depositor1.address)).to.be.equal(0)
      })
    })

    context("when the vault is not empty", () => {
      context("when there is one depositor", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await acreBtc.getAddress(), amountToDeposit)

          await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
        })

        it("should return the correct amount of assets", async () => {
          const depositFee = feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          expect(await acreBtc.assetsBalanceOf(depositor1.address)).to.be.equal(
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
            .approve(await acreBtc.getAddress(), depositor1AmountToDeposit)

          await acreBtc
            .connect(depositor1)
            .deposit(depositor1AmountToDeposit, depositor1.address)

          await tbtc
            .connect(depositor2)
            .approve(await acreBtc.getAddress(), depositor2AmountToDeposit)

          await acreBtc
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
              await acreBtc.assetsBalanceOf(depositor1.address),
              "invalid assets balance of depositor 1",
            ).to.be.equal(depositor1AmountToDeposit - deposit1Fee)

            expect(
              await acreBtc.assetsBalanceOf(depositor2.address),
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
            await tbtc.mint(await acreBtc.getAddress(), earnedYield)
          })

          it("should return the correct amount of assets", async () => {
            expectCloseTo(
              await acreBtc.assetsBalanceOf(depositor1.address),
              expectedAssets1,
            )

            expectCloseTo(
              await acreBtc.assetsBalanceOf(depositor2.address),
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
          minimumDepositAmount = await acreBtc.minimumDepositAmount()
          amountToDeposit = minimumDepositAmount - 1n
        })

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(depositor1)
              .deposit(amountToDeposit, receiver.address),
          )
            .to.be.revertedWithCustomError(acreBtc, "LessThanMinDeposit")
            .withArgs(amountToDeposit, minimumDepositAmount)
        })
      })

      context("when amount to deposit is equal to the minimum amount", () => {
        beforeAfterSnapshotWrapper()

        let amountToDeposit: bigint
        let tx: ContractTransactionResponse
        let expectedReceivedShares: bigint

        before(async () => {
          const minimumDepositAmount = await acreBtc.minimumDepositAmount()
          amountToDeposit = minimumDepositAmount

          expectedReceivedShares =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          await tbtc.approve(await acreBtc.getAddress(), amountToDeposit)
          tx = await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, receiver.address)
        })

        it("should emit Deposit event", async () => {
          await expect(tx).to.emit(acreBtc, "Deposit").withArgs(
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

        it("should mint acreBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
            [receiver.address],
            [expectedReceivedShares],
          )
        })

        it("should transfer tBTC tokens to Acre", async () => {
          const actualDepositdAmount =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)

          await expect(tx).to.changeTokenBalances(
            tbtc,
            [depositor1.address, acreBtc],
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
            .approve(await acreBtc.getAddress(), amountToDeposit)
        })

        it("should revert", async () => {
          await expect(
            acreBtc.connect(depositor1).deposit(amountToDeposit, ZeroAddress),
          )
            .to.be.revertedWithCustomError(acreBtc, "ERC20InvalidReceiver")
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
          .approve(await acreBtc.getAddress(), depositor1AmountToDeposit)
        await tbtc
          .connect(depositor2)
          .approve(await acreBtc.getAddress(), depositor2AmountToDeposit)
      })

      context("when the vault is in initial state", () => {
        context("when two depositors deposit", () => {
          let depositTx1: ContractTransactionResponse
          let depositTx2: ContractTransactionResponse

          before(async () => {
            depositTx1 = await acreBtc
              .connect(depositor1)
              .deposit(depositor1AmountToDeposit, depositor1.address)

            depositTx2 = await acreBtc
              .connect(depositor2)
              .deposit(depositor2AmountToDeposit, depositor2.address)

            afterDepositsSnapshot = await takeSnapshot()
          })

          it("depositor 1 should receive shares equal to a deposited amount", async () => {
            const expectedShares =
              depositor1AmountToDeposit -
              feeOnTotal(depositor1AmountToDeposit, entryFeeBasisPoints)

            await expect(depositTx1).to.changeTokenBalances(
              acreBtc,
              [depositor1.address],
              [expectedShares],
            )
          })

          it("depositor 2 should receive shares equal to a deposited amount", async () => {
            const expectedShares =
              depositor2AmountToDeposit -
              feeOnTotal(depositor2AmountToDeposit, entryFeeBasisPoints)

            await expect(depositTx2).to.changeTokenBalances(
              acreBtc,
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

            expect(await acreBtc.totalAssets()).to.eq(
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

            depositor1SharesBefore = await acreBtc.balanceOf(depositor1.address)
            depositor2SharesBefore = await acreBtc.balanceOf(depositor2.address)

            // Simulating yield returned from strategies. The vault now contains
            // more tokens than deposited which causes the exchange rate to
            // change.
            await tbtc.mint(await acreBtc.getAddress(), earnedYield)
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

            expect(await acreBtc.totalAssets()).to.be.eq(
              actualDepositAmount1 + actualDepositAmount2 + earnedYield,
            )
          })

          it("the depositors shares should be the same", async () => {
            expect(await acreBtc.balanceOf(depositor1.address)).to.be.eq(
              depositor1SharesBefore,
            )
            expect(await acreBtc.balanceOf(depositor2.address)).to.be.eq(
              depositor2SharesBefore,
            )
          })
        })

        context("when depositor 1 deposits more tokens", () => {
          const newAmountToDeposit = to1e18(2)
          let sharesBefore: bigint

          before(async () => {
            await afterSimulatingYieldSnapshot.restore()

            sharesBefore = await acreBtc.balanceOf(depositor1.address)

            await tbtc.mint(depositor1.address, newAmountToDeposit)

            await tbtc
              .connect(depositor1)
              .approve(await acreBtc.getAddress(), newAmountToDeposit)

            await acreBtc
              .connect(depositor1)
              .deposit(newAmountToDeposit, depositor1.address)
            // State after deposit:
            // Shares to mint = (assets * acreBTCSupply / totalTBTCInAcre) = 2 * 10 / 15 = ~1.333333333333333333
            // Total assets = 7(depositor 1) + 3(depositor 2) + 5(yield) + 2 = 17
            // Total shares = 7 + 3 + ~1.3 = 11.333333333333333333
          })

          it("should receive more shares", async () => {
            const expectedSharesToMint =
              await acreBtc.previewDeposit(newAmountToDeposit)

            const shares = await acreBtc.balanceOf(depositor1.address)

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
          .approve(await acreBtc.getAddress(), amountToSpend)

        tx = await acreBtc
          .connect(depositor1)
          .mint(sharesToMint, receiver.address)
      })

      it("should emit Deposit event", async () => {
        await expect(tx).to.emit(acreBtc, "Deposit").withArgs(
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

      it("should mint acreBTC tokens", async () => {
        await expect(tx).to.changeTokenBalances(
          acreBtc,
          [receiver.address],
          [sharesToMint],
        )
      })

      it("should transfer tBTC tokens to Acre", async () => {
        await expect(tx).to.changeTokenBalances(
          tbtc,
          [depositor1.address, acreBtc],
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
          minimumDepositAmount = await acreBtc.minimumDepositAmount()
          const shares =
            minimumDepositAmount -
            feeOnTotal(minimumDepositAmount, entryFeeBasisPoints)

          sharesToMint = shares - 1n
          await tbtc
            .connect(depositor1)
            .approve(
              await acreBtc.getAddress(),
              await acreBtc.previewMint(shares),
            )
        })

        it("should take into account the min deposit amount parameter and revert", async () => {
          // In this test case, there is only one depositor and the token vault has
          // not earned anything yet so received shares are equal to deposited
          // tokens amount.
          const depositAmount = await acreBtc.previewMint(sharesToMint)
          await expect(
            acreBtc.connect(depositor1).mint(sharesToMint, receiver.address),
          )
            .to.be.revertedWithCustomError(acreBtc, "LessThanMinDeposit")
            .withArgs(depositAmount, minimumDepositAmount)
        })
      },
    )
  })

  describe("redeem", () => {
    beforeAfterSnapshotWrapper()

    context("when acreBTC did not allocate any assets", () => {
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
            .approve(await acreBtc.getAddress(), amountToDeposit)
          shares =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
          await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          amountDeposited =
            amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
          amountToRedeem =
            amountDeposited - feeOnTotal(amountDeposited, exitFeeBasisPoints)
          tx = await acreBtc
            .connect(depositor1)
            .redeem(shares, thirdParty, depositor1)
        })

        it("should emit Redeem event", async () => {
          await expect(tx).to.emit(acreBtc, "Withdraw").withArgs(
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

        it("should burn acreBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
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
            .approve(await acreBtc.getAddress(), totalDeposit)
          await acreBtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)
          await acreBtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)
        })

        it("should be able to redeem tokens from the first and second deposit", async () => {
          const shares = await acreBtc.balanceOf(depositor1.address)
          const redeemTx = await acreBtc.redeem(
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

          await expect(redeemTx).to.emit(acreBtc, "Withdraw").withArgs(
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

    context("when acreBTC allocated all of the assets", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC with Midas Allocator.
        await midasAllocator.connect(maintainer).allocate()
      })

      it("should revert", async () => {
        const expectedRedeemedAssets =
          to1e18(2) - feeOnTotal(to1e18(2), exitFeeBasisPoints)

        await expect(
          // Depositor redeems 2 acreBTC.
          acreBtc.connect(depositor1).redeem(to1e18(2), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
          .withArgs(await acreBtc.getAddress(), 0, expectedRedeemedAssets)
      })
    })

    context("when acreBTC allocated some of the assets", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC with Midas Allocator.
        await midasAllocator.connect(maintainer).allocate()

        // Donate 1 tBTC to acreBTC.
        await tbtc.mint(await acreBtc.getAddress(), to1e18(1))

        // Deposit additional 1 tBTC.
        await tbtc.mint(depositor2.address, to1e18(1))
        await tbtc
          .connect(depositor2)
          .approve(await acreBtc.getAddress(), to1e18(1))
        // Depositor deposits 2 tBTC.
        await acreBtc.connect(depositor2).deposit(to1e18(1), depositor2.address)
      })

      describe("when unallocated assets are greater than the amount to redeem", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        let expectedRedeemedAssets: bigint
        let redeemFee: bigint

        before(async () => {
          // Depositor redeems 2 acreBTC.
          tx = await acreBtc
            .connect(depositor1)
            .redeem(to1e18(1), depositor1, depositor1)

          expectedRedeemedAssets = await acreBtc.previewRedeem(to1e18(1))
          redeemFee = feeOnRaw(expectedRedeemedAssets, exitFeeBasisPoints)
        })

        it("should transfer tBTC back to a depositor1", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [depositor1.address],
            [expectedRedeemedAssets],
          )
        })

        it("should use unallocated assets", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [await acreBtc.getAddress()],
            [-(expectedRedeemedAssets + redeemFee)],
          )
        })

        it("should transfer redeem fee to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [treasury.address],
            [redeemFee],
          )
        })

        it("should emit Withdraw event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "Withdraw")
            .withArgs(
              depositor1.address,
              depositor1.address,
              depositor1.address,
              expectedRedeemedAssets,
              to1e18(1),
            )
        })
      })

      describe("when unallocated assets are less than the amount to redeem", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          const shares = await acreBtc.convertToShares(amountToDeposit)
          const expectedRedeemedAssets =
            amountToDeposit -
            feeOnTotal(amountToDeposit, exitFeeBasisPoints) -
            2n // Adjust for rounding

          await expect(
            // Depositor redeems 2 acreBTC.
            acreBtc.connect(depositor1).redeem(shares, depositor1, depositor1),
          )
            .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
            .withArgs(
              await acreBtc.getAddress(),
              await tbtc.balanceOf(await acreBtc.getAddress()),
              expectedRedeemedAssets,
            )
        })
      })
    })

    context("when the entry and exit fee is zero", () => {
      beforeAfterSnapshotWrapper()

      context("when redeeming from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse

        before(async () => {
          await acreBtc.connect(governance).updateExitFeeBasisPoints(0)
          await acreBtc.connect(governance).updateEntryFeeBasisPoints(0)

          await tbtc
            .connect(depositor1)
            .approve(await acreBtc.getAddress(), amountToDeposit)

          await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await acreBtc
            .connect(depositor1)
            .redeem(amountToDeposit, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(acreBtc, "Withdraw").withArgs(
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

        it("should burn acreBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
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

    context("when acreBTC did not allocate any assets", () => {
      context("when withdrawing from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse
        let availableToWithdraw: bigint
        let shares: bigint

        before(async () => {
          await tbtc
            .connect(depositor1)
            .approve(await acreBtc.getAddress(), amountToDeposit)
          shares = 999500249875062468n
          availableToWithdraw = 998501748126935532n
          await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await acreBtc
            .connect(depositor1)
            .withdraw(availableToWithdraw, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(acreBtc, "Withdraw").withArgs(
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

        it("should burn acreBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
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
            .approve(await acreBtc.getAddress(), firstDeposit + secondDeposit)
          await acreBtc
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)

          await acreBtc
            .connect(depositor1)
            .deposit(secondDeposit, depositor1.address)

          shares = 2998500749625187405n
          availableToWithdraw = 2995505244380806598n
          withdrawTx = await acreBtc.withdraw(
            availableToWithdraw,
            depositor1.address,
            depositor1.address,
          )
        })

        it("should emit Withdraw event", async () => {
          await expect(withdrawTx).to.emit(acreBtc, "Withdraw").withArgs(
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

        it("should burn acreBTC tokens", async () => {
          await expect(withdrawTx).to.changeTokenBalances(
            acreBtc,
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

    context("when acreBTC allocated all of the assets", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)
        // Allocate 3 tBTC to Mezo Portal.
        await midasAllocator.connect(maintainer).allocate()
      })

      it("should revert", async () => {
        await expect(
          // Depositor redeems 2 acreBTC.
          acreBtc
            .connect(depositor1)
            .withdraw(to1e18(2), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
          .withArgs(await acreBtc.getAddress(), 0, to1e18(2))
      })
    })

    context("when acreBTC allocated some of the assets", () => {
      beforeAfterSnapshotWrapper()

      const amountToDeposit = to1e18(3)

      before(async () => {
        await tbtc.mint(depositor1.address, amountToDeposit)
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amountToDeposit)
        // Depositor deposits 3 tBTC.
        await acreBtc
          .connect(depositor1)
          .deposit(amountToDeposit, depositor1.address)

        // Allocate 3 tBTC with Midas Allocator.
        await midasAllocator.connect(maintainer).allocate()

        // Donate 1 tBTC to acreBTC.
        await tbtc.mint(await acreBtc.getAddress(), to1e18(1))

        // Deposit additional 1 tBTC.
        await tbtc.mint(depositor2.address, to1e18(1))
        await tbtc
          .connect(depositor2)
          .approve(await acreBtc.getAddress(), to1e18(1))
        // Depositor deposits 1 tBTC.
        await acreBtc.connect(depositor2).deposit(to1e18(1), depositor2.address)
      })

      describe("when unallocated assets are greater than the amount to withdraw", () => {
        beforeAfterSnapshotWrapper()

        let tx: ContractTransactionResponse

        let withdrawalFee: bigint

        before(async () => {
          // Depositor withdraws 1 acreBTC.
          tx = await acreBtc
            .connect(depositor1)
            .withdraw(to1e18(1), depositor1, depositor1)

          withdrawalFee = feeOnRaw(to1e18(1), exitFeeBasisPoints)
        })

        it("should transfer 2 tBTC back to a depositor1", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [depositor1.address],
            [to1e18(1)],
          )
        })

        it("should use unallocated assets", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [await acreBtc.getAddress()],
            [-(to1e18(1) + withdrawalFee)],
          )
        })

        it("should transfer withdrawal fee to Treasury", async () => {
          await expect(tx).to.changeTokenBalances(
            tbtc,
            [treasury.address],
            [withdrawalFee],
          )
        })

        it("should emit Withdraw event", async () => {
          const sharesToBurnWithNoFees = await acreBtc.convertToShares(
            to1e18(1),
          )

          // Add the withdrawal fee. Adjust for rounding.
          const sharesToBurn =
            sharesToBurnWithNoFees +
            feeOnRaw(sharesToBurnWithNoFees, exitFeeBasisPoints)

          await expect(tx)
            .to.emit(acreBtc, "Withdraw")
            .withArgs(
              depositor1.address,
              depositor1.address,
              depositor1.address,
              to1e18(1),
              sharesToBurn,
            )
        })
      })

      describe("when unallocated assets are less than the amount to withdraw", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(depositor1)
              .withdraw(to1e18(3), depositor1, depositor1),
          )
            .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
            .withArgs(
              await acreBtc.getAddress(),
              await tbtc.balanceOf(await acreBtc.getAddress()),
              to1e18(3),
            )
        })
      })
    })

    context("when the entry and exit fee is zero", () => {
      beforeAfterSnapshotWrapper()

      context("when withdrawing from a single deposit", () => {
        beforeAfterSnapshotWrapper()

        const amountToDeposit = to1e18(1)
        let tx: ContractTransactionResponse

        before(async () => {
          await acreBtc.connect(governance).updateExitFeeBasisPoints(0)
          await acreBtc.connect(governance).updateEntryFeeBasisPoints(0)

          await tbtc
            .connect(depositor1)
            .approve(await acreBtc.getAddress(), amountToDeposit)

          await acreBtc
            .connect(depositor1)
            .deposit(amountToDeposit, depositor1.address)
          tx = await acreBtc
            .connect(depositor1)
            .withdraw(amountToDeposit, thirdParty, depositor1)
        })

        it("should emit Withdraw event", async () => {
          await expect(tx).to.emit(acreBtc, "Withdraw").withArgs(
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

        it("should burn acreBTC tokens", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
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

  describe("requestRedeem", () => {
    beforeAfterSnapshotWrapper()

    const receiver = ethers.Wallet.createRandom()

    context("when withdrawal queue is not set", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await acreBtc.connect(governance).updateWithdrawalQueue(ZeroAddress)
      })

      it("should revert", async () => {
        await expect(
          acreBtc
            .connect(depositor1)
            .requestRedeem(to1e18(1), receiver, depositor1),
        ).to.be.revertedWithCustomError(acreBtc, "WithdrawalQueueNotSet")
      })
    })

    context("when user has sufficient acreBTC balance", () => {
      beforeAfterSnapshotWrapper()

      const depositedAmount = to1e18(3)
      let expectedShares: bigint

      before(async () => {
        await acreBtc
          .connect(governance)
          .updateExitFeeBasisPoints(exitFeeBasisPoints)

        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), depositedAmount)

        await acreBtc
          .connect(depositor1)
          .deposit(depositedAmount, depositor1.address)

        await midasAllocator.connect(maintainer).allocate()

        expectedShares =
          depositedAmount - feeOnTotal(depositedAmount, entryFeeBasisPoints)
      })

      describe("when caller does not have sufficient allowance", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await acreBtc.connect(depositor1).approve(caller.address, to1e18(1))
        })

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(caller)
              .requestRedeem(to1e18(2), receiver, depositor1),
          )
            .to.be.revertedWithCustomError(
              acreBtc,
              "ERC20InsufficientAllowance",
            )
            .withArgs(caller.address, to1e18(1), to1e18(2))
        })
      })

      describe("when redeem amount is greater than the balance", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await acreBtc.connect(depositor1).approve(caller.address, to1e18(5))
        })

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(caller)
              .requestRedeem(to1e18(4), receiver, depositor1),
          )
            .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
            .withArgs(depositor1.address, expectedShares, to1e18(4))
        })
      })

      describe("when redeem amount is less than the balance", () => {
        beforeAfterSnapshotWrapper()

        const redeemShares = to1e18(2)
        const expectedRequestId = 1n

        let tx: ContractTransactionResponse

        before(async () => {
          await acreBtc
            .connect(depositor1)
            .approve(caller.address, redeemShares)

          tx = await acreBtc
            .connect(caller)
            .requestRedeem(redeemShares, receiver, depositor1)
        })

        it("should emit RedemptionRequested event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "RedemptionRequested")
            .withArgs(
              expectedRequestId,
              depositor1.address,
              receiver.address,
              caller.address,
              redeemShares,
            )
        })

        it("should call withdrawal queue to redeem shares", async () => {
          await expect(tx).to.emit(withdrawalQueue, "RedeemRequested")
        })

        it("should burn shares", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
            [depositor1],
            [-redeemShares],
          )

          expect(await acreBtc.totalSupply()).to.be.equal(
            expectedShares - redeemShares,
          )
        })
      })

      describe("when caller is the deposit owner", () => {
        beforeAfterSnapshotWrapper()

        it("should not require allowance", async () => {
          const tx = await acreBtc
            .connect(depositor1)
            .requestRedeem(to1e18(2), receiver, depositor1)

          await expect(tx)
            .to.emit(acreBtc, "RedemptionRequested")
            .withArgs(
              1,
              depositor1.address,
              receiver.address,
              depositor1.address,
              to1e18(2),
            )
        })
      })
    })
  })

  describe("requestRedeemAndBridge", () => {
    beforeAfterSnapshotWrapper()

    context("when withdrawal queue is not set", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await acreBtc.connect(governance).updateWithdrawalQueue(ZeroAddress)
      })

      it("should revert", async () => {
        await expect(
          acreBtc
            .connect(depositor1)
            .requestRedeemAndBridge(to1e18(1), depositor1, "0x01"),
        ).to.be.revertedWithCustomError(acreBtc, "WithdrawalQueueNotSet")
      })
    })

    context("when user has sufficient acreBTC balance", () => {
      beforeAfterSnapshotWrapper()

      const depositedAmount = to1e18(3)
      let expectedShares: bigint

      before(async () => {
        await acreBtc
          .connect(governance)
          .updateExitFeeBasisPoints(exitFeeBasisPoints)

        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), depositedAmount)

        await acreBtc
          .connect(depositor1)
          .deposit(depositedAmount, depositor1.address)

        await midasAllocator.connect(maintainer).allocate()

        expectedShares =
          depositedAmount - feeOnTotal(depositedAmount, entryFeeBasisPoints)
      })

      describe("when caller does not have sufficient allowance", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await acreBtc.connect(depositor1).approve(caller.address, to1e18(1))
        })

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(caller)
              .requestRedeemAndBridge(to1e18(2), depositor1, "0x01"),
          )
            .to.be.revertedWithCustomError(
              acreBtc,
              "ERC20InsufficientAllowance",
            )
            .withArgs(caller.address, to1e18(1), to1e18(2))
        })
      })

      describe("when redeem amount is greater than the balance", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await acreBtc.connect(depositor1).approve(caller.address, to1e18(5))
        })

        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(caller)
              .requestRedeemAndBridge(to1e18(4), depositor1, "0x01"),
          )
            .to.be.revertedWithCustomError(acreBtc, "ERC20InsufficientBalance")
            .withArgs(depositor1.address, expectedShares, to1e18(4))
        })
      })

      describe("when redeem amount is less than the balance", () => {
        beforeAfterSnapshotWrapper()

        const redeemShares = to1e18(2)
        const expectedRequestId = 1n

        let tx: ContractTransactionResponse

        before(async () => {
          await acreBtc
            .connect(depositor1)
            .approve(caller.address, redeemShares)

          tx = await acreBtc
            .connect(caller)
            .requestRedeemAndBridge(redeemShares, depositor1, "0x01")
        })

        it("should emit RedemptionToBitcoinRequested event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "RedemptionToBitcoinRequested")
            .withArgs(
              expectedRequestId,
              depositor1.address,
              caller.address,
              redeemShares,
            )
        })

        it("should call withdrawal queue to redeem shares", async () => {
          await expect(tx).to.emit(withdrawalQueue, "RedeemAndBridgeRequested")
        })

        it("should burn shares", async () => {
          await expect(tx).to.changeTokenBalances(
            acreBtc,
            [depositor1],
            [-redeemShares],
          )

          expect(await acreBtc.totalSupply()).to.be.equal(
            expectedShares - redeemShares,
          )
        })
      })

      describe("when caller is the deposit owner", () => {
        beforeAfterSnapshotWrapper()

        it("should not require allowance", async () => {
          const tx = await acreBtc
            .connect(depositor1)
            .requestRedeemAndBridge(to1e18(2), depositor1, "0x01")

          await expect(tx)
            .to.emit(acreBtc, "RedemptionToBitcoinRequested")
            .withArgs(1, depositor1.address, depositor1.address, to1e18(2))
        })
      })
    })
  })

  describe("burn", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not the withdrawal queue", () => {
      it("should revert", async () => {
        await expect(
          acreBtc.connect(thirdParty).burn(to1e18(1)),
        ).to.be.revertedWithCustomError(acreBtc, "OnlyWithdrawalQueue")
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
          tx = await acreBtc
            .connect(governance)
            .updateMinimumDepositAmount(validMinimumDepositAmount)
        })

        it("should emit MinimumDepositAmountUpdated event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "MinimumDepositAmountUpdated")
            .withArgs(validMinimumDepositAmount)
        })

        it("should update parameters correctly", async () => {
          const minimumDepositAmount = await acreBtc.minimumDepositAmount()

          expect(minimumDepositAmount).to.be.eq(validMinimumDepositAmount)
        })
      })

      context("when minimum deposit amount is 0", () => {
        beforeAfterSnapshotWrapper()

        const newMinimumDepositAmount = 0

        before(async () => {
          await acreBtc
            .connect(governance)
            .updateMinimumDepositAmount(newMinimumDepositAmount)
        })

        it("should update the minimum deposit amount correctly", async () => {
          const minimumDepositAmount = await acreBtc.minimumDepositAmount()

          expect(minimumDepositAmount).to.be.eq(newMinimumDepositAmount)
        })
      })
    })

    context("when it is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          acreBtc
            .connect(depositor1)
            .updateMinimumDepositAmount(validMinimumDepositAmount),
        )
          .to.be.revertedWithCustomError(acreBtc, "OwnableUnauthorizedAccount")
          .withArgs(depositor1.address)
      })
    })
  })

  describe("updateDispatcher", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(acreBtc.connect(thirdParty).updateDispatcher(ZeroAddress))
          .to.be.revertedWithCustomError(acreBtc, "OwnableUnauthorizedAccount")
          .withArgs(thirdParty.address)
      })
    })

    context("when caller is governance", () => {
      context("when a new dispatcher is zero address", () => {
        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateDispatcher(ZeroAddress),
          ).to.be.revertedWithCustomError(acreBtc, "ZeroAddress")
        })
      })

      context("when a new dispatcher is the same as the old one", () => {
        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateDispatcher(midasAllocator),
          ).to.be.revertedWithCustomError(acreBtc, "SameDispatcher")
        })
      })

      context("when a new dispatcher is non-zero address", () => {
        let newDispatcher: string
        let acreBtcAddress: string
        let dispatcherAddress: string
        let tx: ContractTransactionResponse

        before(async () => {
          // Dispatcher is set by the deployment scripts. See deployment tests
          // where initial parameters are checked.
          dispatcherAddress = await midasAllocator.getAddress()
          newDispatcher = await ethers.Wallet.createRandom().getAddress()
          acreBtcAddress = await acreBtc.getAddress()

          tx = await acreBtc.connect(governance).updateDispatcher(newDispatcher)
        })

        it("should update the dispatcher", async () => {
          expect(await acreBtc.dispatcher()).to.be.equal(newDispatcher)
        })

        it("should reset approval amount for the old dispatcher", async () => {
          const allowance = await tbtc.allowance(
            acreBtcAddress,
            dispatcherAddress,
          )
          expect(allowance).to.be.equal(0)
        })

        it("should approve max amount for the new dispatcher", async () => {
          const allowance = await tbtc.allowance(acreBtcAddress, newDispatcher)
          expect(allowance).to.be.equal(MaxUint256)
        })

        it("should emit DispatcherUpdated event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "DispatcherUpdated")
            .withArgs(dispatcherAddress, newDispatcher)
        })
      })
    })
  })

  describe("updateTreasury", () => {
    beforeAfterSnapshotWrapper()

    context("when caller is not governance", () => {
      it("should revert", async () => {
        await expect(acreBtc.connect(thirdParty).updateTreasury(ZeroAddress))
          .to.be.revertedWithCustomError(acreBtc, "OwnableUnauthorizedAccount")
          .withArgs(thirdParty.address)
      })
    })

    context("when caller is governance", () => {
      context("when a new treasury is zero address", () => {
        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateTreasury(ZeroAddress),
          ).to.be.revertedWithCustomError(acreBtc, "ZeroAddress")
        })
      })

      context("when a new treasury is same as the old one", () => {
        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateTreasury(treasury),
          ).to.be.revertedWithCustomError(acreBtc, "SameTreasury")
        })
      })

      context("when a new treasury is Acre address", () => {
        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateTreasury(acreBtc),
          ).to.be.revertedWithCustomError(acreBtc, "DisallowedAddress")
        })
      })

      context("when a new treasury is an allowed address", () => {
        let oldTreasury: string
        let newTreasury: string
        let tx: ContractTransactionResponse

        before(async () => {
          // Treasury is set by the deployment scripts. See deployment tests
          // where initial parameters are checked.
          oldTreasury = await acreBtc.treasury()
          newTreasury = await ethers.Wallet.createRandom().getAddress()

          tx = await acreBtc.connect(governance).updateTreasury(newTreasury)
        })

        it("should update the treasury", async () => {
          expect(await acreBtc.treasury()).to.be.equal(newTreasury)
        })

        it("should emit TreasuryUpdated event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "TreasuryUpdated")
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
            tx = await acreBtc.connect(governance).pause()
          })

          it("should change the pause state", async () => {
            expect(await acreBtc.paused()).to.be.true
          })

          it("should emit `Paused` event", async () => {
            await expect(tx)
              .to.emit(acreBtc, "Paused")
              .withArgs(governance.address)
          })
        })

        context("when caller is the pause admin", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            tx = await acreBtc.connect(pauseAdmin).pause()
          })

          it("should change the pause state", async () => {
            expect(await acreBtc.paused()).to.be.true
          })

          it("should emit `Paused` event", async () => {
            await expect(tx)
              .to.emit(acreBtc, "Paused")
              .withArgs(pauseAdmin.address)
          })
        })

        context("when updating pause admin to the same address", () => {
          beforeAfterSnapshotWrapper()

          it("should revert", async () => {
            await expect(
              acreBtc.connect(governance).updatePauseAdmin(pauseAdmin.address),
            ).to.be.revertedWithCustomError(acreBtc, "SamePauseAdmin")
          })
        })
      })

      context("when the unauthorized account tries to pause contract", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(acreBtc.connect(thirdParty).pause())
            .to.be.revertedWithCustomError(
              acreBtc,
              "PausableUnauthorizedAccount",
            )
            .withArgs(thirdParty.address)
        })
      })

      context("when contract is already paused", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await acreBtc.connect(pauseAdmin).pause()
        })

        it("should revert", async () => {
          await expect(
            acreBtc.connect(pauseAdmin).pause(),
          ).to.be.revertedWithCustomError(acreBtc, "EnforcedPause")
        })
      })
    })

    describe("unpause", () => {
      context("when the authorized account wants to unpause contract", () => {
        context("when caller is the owner", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            await acreBtc.connect(governance).pause()

            tx = await acreBtc.connect(governance).unpause()
          })

          it("should change the pause state", async () => {
            expect(await acreBtc.paused()).to.be.false
          })

          it("should emit `Unpaused` event", async () => {
            await expect(tx)
              .to.emit(acreBtc, "Unpaused")
              .withArgs(governance.address)
          })
        })

        context("when caller is the pause admin", () => {
          let tx: ContractTransactionResponse

          beforeAfterSnapshotWrapper()

          before(async () => {
            await acreBtc.connect(pauseAdmin).pause()

            tx = await acreBtc.connect(pauseAdmin).unpause()
          })

          it("should change the pause state", async () => {
            expect(await acreBtc.paused()).to.be.false
          })

          it("should emit `Unpaused` event", async () => {
            await expect(tx)
              .to.emit(acreBtc, "Unpaused")
              .withArgs(pauseAdmin.address)
          })
        })
      })

      context("when the unauthorized account tries to unpause contract", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(acreBtc.connect(thirdParty).unpause())
            .to.be.revertedWithCustomError(
              acreBtc,
              "PausableUnauthorizedAccount",
            )
            .withArgs(thirdParty.address)
        })
      })

      context("when contract is already unpaused", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            acreBtc.connect(pauseAdmin).unpause(),
          ).to.be.revertedWithCustomError(acreBtc, "ExpectedPause")
        })
      })
    })

    describe("contract functions", () => {
      const amount = to1e18(100)
      beforeAfterSnapshotWrapper()

      before(async () => {
        await tbtc.mint(depositor1.address, amount)
        await tbtc
          .connect(depositor1)
          .approve(await acreBtc.getAddress(), amount)
        await acreBtc.connect(depositor1).deposit(amount, depositor1)
        await acreBtc.connect(pauseAdmin).pause()
      })

      it("should pause deposits", async () => {
        await expect(acreBtc.connect(depositor1).deposit(amount, depositor1))
          .to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxDeposit")
          .withArgs(depositor1.address, amount, 0)
      })

      it("should pause minting", async () => {
        await expect(acreBtc.connect(depositor1).mint(amount, depositor1))
          .to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxMint")
          .withArgs(depositor1.address, amount, 0)
      })

      it("should pause withdrawals", async () => {
        await expect(
          acreBtc
            .connect(depositor1)
            .withdraw(to1e18(1), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxWithdraw")
          .withArgs(depositor1.address, to1e18(1), 0)
      })

      it("should pause redemptions", async () => {
        await expect(
          acreBtc.connect(depositor1).redeem(to1e18(1), depositor1, depositor1),
        )
          .to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxRedeem")
          .withArgs(depositor1.address, to1e18(1), 0)
      })

      it("should return 0 when calling maxDeposit", async () => {
        expect(await acreBtc.maxDeposit(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxMint", async () => {
        expect(await acreBtc.maxMint(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxRedeem", async () => {
        expect(await acreBtc.maxRedeem(depositor1)).to.be.eq(0)
      })

      it("should return 0 when calling maxWithdraw", async () => {
        expect(await acreBtc.maxWithdraw(depositor1)).to.be.eq(0)
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
          tx = await acreBtc
            .connect(governance)
            .updateEntryFeeBasisPoints(validEntryFeeBasisPoints)
        })

        it("should emit EntryFeeBasisPointsUpdated event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "EntryFeeBasisPointsUpdated")
            .withArgs(validEntryFeeBasisPoints)
        })

        it("should update entry fee basis points correctly", async () => {
          expect(await acreBtc.entryFeeBasisPoints()).to.be.eq(
            validEntryFeeBasisPoints,
          )
        })
      })

      context("when entry fee basis points are 0", () => {
        beforeAfterSnapshotWrapper()

        const newEntryFeeBasisPoints = 0

        before(async () => {
          await acreBtc
            .connect(governance)
            .updateEntryFeeBasisPoints(newEntryFeeBasisPoints)
        })

        it("should update entry fee basis points correctly", async () => {
          expect(await acreBtc.entryFeeBasisPoints()).to.be.eq(
            newEntryFeeBasisPoints,
          )
        })
      })

      context("when entry fee basis points exceed 10000", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateEntryFeeBasisPoints(10001n),
          ).to.be.revertedWithCustomError(acreBtc, "ExceedsMaxFeeBasisPoints")
        })
      })
    })

    context("when is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          acreBtc.connect(depositor1).updateEntryFeeBasisPoints(100n),
        ).to.be.revertedWithCustomError(acreBtc, "OwnableUnauthorizedAccount")
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
          tx = await acreBtc
            .connect(governance)
            .updateExitFeeBasisPoints(validExitFeeBasisPoints)
        })

        it("should emit ExitFeeBasisPointsUpdated event", async () => {
          await expect(tx)
            .to.emit(acreBtc, "ExitFeeBasisPointsUpdated")
            .withArgs(validExitFeeBasisPoints)
        })

        it("should update exit fee basis points correctly", async () => {
          expect(await acreBtc.exitFeeBasisPoints()).to.be.eq(
            validExitFeeBasisPoints,
          )
        })
      })

      context("when exit fee basis points exceed 10000", () => {
        beforeAfterSnapshotWrapper()

        it("should revert", async () => {
          await expect(
            acreBtc.connect(governance).updateExitFeeBasisPoints(10001n),
          ).to.be.revertedWithCustomError(acreBtc, "ExceedsMaxFeeBasisPoints")
        })
      })

      context("when exit fee basis points are 0", () => {
        beforeAfterSnapshotWrapper()

        const newExitFeeBasisPoints = 0

        before(async () => {
          await acreBtc
            .connect(governance)
            .updateExitFeeBasisPoints(newExitFeeBasisPoints)
        })

        it("should update exit fee basis points correctly", async () => {
          expect(await acreBtc.exitFeeBasisPoints()).to.be.eq(
            newExitFeeBasisPoints,
          )
        })
      })
    })

    context("when is called by non-governance", () => {
      it("should revert", async () => {
        await expect(
          acreBtc.connect(depositor1).updateExitFeeBasisPoints(100n),
        ).to.be.revertedWithCustomError(acreBtc, "OwnableUnauthorizedAccount")
      })
    })
  })

  describe("totalAssets", () => {
    beforeAfterSnapshotWrapper()

    const donation = to1e18(1)
    const firstDeposit = to1e18(2)
    const secondDeposit = to1e18(3)

    context("when there is a dispatcher", () => {
      beforeAfterSnapshotWrapper()

      // Dispatcher is set by the deployment scripts.

      context("when there are no deposits", () => {
        it("should return 0", async () => {
          expect(await acreBtc.totalAssets()).to.be.eq(0)
        })
      })

      context("when there are deposits", () => {
        context("when there is a first deposit made", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await tbtc.mint(depositor1.address, firstDeposit)
            await tbtc
              .connect(depositor1)
              .approve(await acreBtc.getAddress(), firstDeposit)
            await acreBtc
              .connect(depositor1)
              .deposit(firstDeposit, depositor1.address)
          })

          it("should return the total assets", async () => {
            const expectedAssets =
              firstDeposit - feeOnTotal(firstDeposit, entryFeeBasisPoints)
            expect(await acreBtc.totalAssets()).to.be.eq(expectedAssets)
          })

          it("should be equal to tBTC balance of the contract", async () => {
            expect(await acreBtc.totalAssets()).to.be.eq(
              await tbtc.balanceOf(await acreBtc.getAddress()),
            )
          })
        })

        context("when there are two deposits made", () => {
          beforeAfterSnapshotWrapper()

          before(async () => {
            await tbtc.mint(depositor1.address, firstDeposit + secondDeposit)
            await tbtc
              .connect(depositor1)
              .approve(await acreBtc.getAddress(), firstDeposit + secondDeposit)
            await acreBtc
              .connect(depositor1)
              .deposit(firstDeposit, depositor1.address)
            await acreBtc
              .connect(depositor1)
              .deposit(secondDeposit, depositor1.address)
          })

          it("should return the total assets", async () => {
            const expectedAssetsFirstDeposit =
              firstDeposit - feeOnTotal(firstDeposit, entryFeeBasisPoints)
            const expectedAssetsSecondDeposit =
              secondDeposit - feeOnTotal(secondDeposit, entryFeeBasisPoints)
            expect(await acreBtc.totalAssets()).to.be.eq(
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
              .approve(await acreBtc.getAddress(), firstDeposit + secondDeposit)
            await acreBtc
              .connect(depositor1)
              .deposit(firstDeposit, depositor1.address)
            await acreBtc
              .connect(depositor1)
              .deposit(secondDeposit, depositor1.address)
            await midasAllocator.connect(maintainer).allocate()
          })

          it("should return the total assets", async () => {
            const deposits = firstDeposit + secondDeposit
            const expectedAssets =
              deposits - feeOnTotal(deposits, entryFeeBasisPoints)
            expect(await acreBtc.totalAssets()).to.be.eq(expectedAssets)
          })
        })

        context("when there is a donation made", () => {
          beforeAfterSnapshotWrapper()

          let totalAssetsBeforeDonation: bigint

          before(async () => {
            await tbtc.mint(depositor1.address, firstDeposit)
            await tbtc
              .connect(depositor1)
              .approve(await acreBtc.getAddress(), firstDeposit)
            await acreBtc
              .connect(depositor1)
              .deposit(firstDeposit, depositor1.address)
            totalAssetsBeforeDonation = await acreBtc.totalAssets()
            await tbtc.mint(await acreBtc.getAddress(), donation)
          })

          it("should return the total assets", async () => {
            expect(await acreBtc.totalAssets()).to.be.eq(
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
              .approve(await acreBtc.getAddress(), firstDeposit)
            await acreBtc
              .connect(depositor1)
              .deposit(firstDeposit, depositor1.address)
            totalAssetsBeforeWithdrawal = await acreBtc.totalAssets()
            await acreBtc
              .connect(depositor1)
              .withdraw(to1e18(1), depositor1, depositor1)
          })

          it("should return the total assets", async () => {
            const actualWithdrawnAssets =
              to1e18(1) + feeOnRaw(to1e18(1), exitFeeBasisPoints)
            expect(await acreBtc.totalAssets()).to.be.eq(
              totalAssetsBeforeWithdrawal - actualWithdrawnAssets,
            )
          })
        })
      })
    })

    context("when there is no dispatcher", () => {
      beforeAfterSnapshotWrapper()

      let acreBtcWithoutDispatcher: AcreBTC

      before(async () => {
        const acreBtcFactory = await ethers.getContractFactory("acreBTC")

        acreBtcWithoutDispatcher = (await upgrades.deployProxy(
          acreBtcFactory,
          [await tbtc.getAddress(), treasury.address],
          {
            kind: "transparent",
            initialOwner: governance.address,
          },
        )) as unknown as AcreBTC
      })

      context("when there are no deposits", () => {
        it("should return 0", async () => {
          expect(await acreBtcWithoutDispatcher.totalAssets()).to.be.eq(0)
        })
      })

      context("when there are deposits", () => {
        it("should return the total assets", async () => {
          await tbtc.mint(depositor1.address, firstDeposit)
          await tbtc
            .connect(depositor1)
            .approve(await acreBtcWithoutDispatcher.getAddress(), firstDeposit)
          await acreBtcWithoutDispatcher
            .connect(depositor1)
            .deposit(firstDeposit, depositor1.address)

          expect(await acreBtcWithoutDispatcher.totalAssets()).to.be.eq(
            firstDeposit,
          )

          await tbtc.mint(await acreBtcWithoutDispatcher.getAddress(), donation)

          expect(await acreBtcWithoutDispatcher.totalAssets()).to.be.eq(
            firstDeposit + donation,
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
        .approve(await acreBtc.getAddress(), amountToDeposit)
      await acreBtc
        .connect(depositor1)
        .deposit(amountToDeposit, depositor1.address)
      expectedDepositedAmount =
        amountToDeposit - feeOnTotal(amountToDeposit, entryFeeBasisPoints)
      expectedWithdrawnAmount =
        expectedDepositedAmount -
        feeOnTotal(expectedDepositedAmount, exitFeeBasisPoints)
    })

    it("should account for the exit fee", async () => {
      const maxWithdraw = await acreBtc.maxWithdraw(depositor1.address)

      expect(maxWithdraw).to.be.eq(expectedWithdrawnAmount)
    })

    it("should be equal to the actual redeemable amount", async () => {
      const maxWithdraw = await acreBtc.maxWithdraw(depositor1.address)
      const availableShares = await acreBtc.balanceOf(depositor1.address)

      const tx = await acreBtc.redeem(
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

  // 10 is added or subtracted to/from the expected value to match the Solidity
  // math which rounds up or down depending on the modulo remainder. It is a very
  // small number.
  function expectCloseTo(actual: bigint, expected: bigint) {
    return expect(actual, "invalid asset balance").to.be.closeTo(expected, 10n)
  }
})
