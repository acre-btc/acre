import {
  loadFixture,
  impersonateAccount,
  setBalance,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"

import { ethers, helpers } from "hardhat"
import { expect } from "chai"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

import { ContractTransactionResponse } from "ethers"
import { deployment } from "./helpers"
import { beforeAfterSnapshotWrapper } from "./helpers/snapshot"
import { to1e18 } from "./utils"

import {
  BitcoinDepositor,
  FeesReimbursementPool,
  TestERC20,
} from "../typechain"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { bitcoinDepositorV2, feesReimbursementPool, tbtc } = await deployment()
  const { governance } = await getNamedSigners()
  const [_, thirdParty] = await getUnnamedSigners()

  return {
    bitcoinDepositor: bitcoinDepositorV2,
    feesReimbursementPool,
    tbtc,
    governance,
    thirdParty,
  }
}

describe("FeesReimbursementPool", () => {
  let tbtc: TestERC20
  let feesReimbursementPool: FeesReimbursementPool

  let feesReimbursementPoolAddress: string
  let bitcoinDepositorAddress: string

  let bitcoinDepositorFakeSigner: HardhatEthersSigner
  let governance: HardhatEthersSigner
  let thirdParty: HardhatEthersSigner

  before(async () => {
    let bitcoinDepositor: BitcoinDepositor
    ;({
      feesReimbursementPool,
      tbtc,
      bitcoinDepositor,
      governance,
      thirdParty,
    } = await loadFixture(fixture))

    feesReimbursementPoolAddress = await feesReimbursementPool.getAddress()
    bitcoinDepositorAddress = await bitcoinDepositor.getAddress()

    await impersonateAccount(bitcoinDepositorAddress)
    bitcoinDepositorFakeSigner = await ethers.getSigner(bitcoinDepositorAddress)
    await setBalance(bitcoinDepositorAddress, to1e18(1))
  })

  after(async () => {
    await stopImpersonatingAccount(
      await bitcoinDepositorFakeSigner.getAddress(),
    )
  })

  describe("reimburse", () => {
    context("when called by third party", () => {
      it("should revert", async () => {
        await expect(
          feesReimbursementPool.connect(thirdParty).reimburse(1),
        ).to.be.revertedWithCustomError(
          feesReimbursementPool,
          "CallerNotBitcoinDepositor",
        )
      })
    })

    context("when called by the bitcoin depositor contract", () => {
      beforeAfterSnapshotWrapper()

      context("when amount is zero", () => {
        it("should revert", async () => {
          await expect(
            feesReimbursementPool
              .connect(bitcoinDepositorFakeSigner)
              .reimburse(0),
          ).to.be.revertedWithCustomError(feesReimbursementPool, "ZeroAmount")
        })
      })

      context("when amount is non-zero", () => {
        const testReimbursement = (
          toReimburse: bigint,
          poolBalance: bigint,
          expectedReimbursement: bigint,
        ) => {
          beforeAfterSnapshotWrapper()

          let result: bigint
          let tx: ContractTransactionResponse

          before(async () => {
            await tbtc.mint(feesReimbursementPoolAddress, poolBalance)

            result = await feesReimbursementPool
              .connect(bitcoinDepositorFakeSigner)
              .reimburse.staticCall(toReimburse)

            tx = await feesReimbursementPool
              .connect(bitcoinDepositorFakeSigner)
              .reimburse(toReimburse)
          })

          it("should return the reimbursed amount", () => {
            expect(result).to.equal(expectedReimbursement)
          })

          it("should reimburse the expected amount", async () => {
            await expect(tx).to.changeTokenBalance(
              tbtc,
              feesReimbursementPoolAddress,
              -expectedReimbursement,
            )
            await expect(tx).to.changeTokenBalance(
              tbtc,
              bitcoinDepositorAddress,
              expectedReimbursement,
            )
          })

          it("should emit Reimbursed event", async () => {
            await expect(tx)
              .to.emit(feesReimbursementPool, "Reimbursed")
              .withArgs(expectedReimbursement)
          })

          it("should leave remaining amount in the pool", async () => {
            expect(await tbtc.balanceOf(feesReimbursementPoolAddress)).to.eq(
              poolBalance - expectedReimbursement,
            )
          })
        }

        context(
          "when there is more funds in the pool than to be reimbursed",
          () => {
            testReimbursement(to1e18(1), to1e18(3), to1e18(1))
          },
        )

        context(
          "when there is less funds in the pool than to be reimbursed",
          () => {
            testReimbursement(to1e18(5), to1e18(2), to1e18(2))
          },
        )

        context("when there are just enough funds in the pool", () => {
          testReimbursement(to1e18(3), to1e18(3), to1e18(3))
        })

        context("when there are no funds in the pool", () => {
          testReimbursement(to1e18(1), to1e18(0), to1e18(0))
        })
      })
    })
  })

  describe("withdraw", () => {
    context("when called by a third party", () => {
      it("should revert", async () => {
        await expect(
          feesReimbursementPool
            .connect(thirdParty)
            .withdraw(thirdParty.address, 1),
        ).to.revertedWithCustomError(
          feesReimbursementPool,
          "OwnableUnauthorizedAccount",
        )
      })
    })

    context("when called by the owner", () => {
      beforeAfterSnapshotWrapper()

      const balance = to1e18(30)
      const toWithdraw = to1e18(3)
      let tx: ContractTransactionResponse

      before(async () => {
        await tbtc.mint(feesReimbursementPoolAddress, balance)

        tx = await feesReimbursementPool
          .connect(governance)
          .withdraw(governance.address, toWithdraw)
      })

      it("should withdraw funds", async () => {
        await expect(tx).to.changeTokenBalance(
          tbtc,
          governance.address,
          toWithdraw,
        )
        await expect(tx).to.changeTokenBalance(
          tbtc,
          feesReimbursementPool,
          -toWithdraw,
        )
      })

      it("should emit Withdrawn event", async () => {
        await expect(tx)
          .to.emit(feesReimbursementPool, "Withdrawn")
          .withArgs(governance.address, toWithdraw)
      })
    })
  })
})
