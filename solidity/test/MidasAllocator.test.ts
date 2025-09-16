import { helpers, ethers } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"
import {
  impersonateAccount,
  loadFixture,
  setBalance,
  stopImpersonatingAccount,
} from "@nomicfoundation/hardhat-toolbox/network-helpers"

import { ContractTransactionResponse } from "ethers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"

import {
  AcreBTC as acreBTC,
  TestERC20,
  MidasAllocator,
  MidasVaultStub,
} from "../typechain"

import { to1e18 } from "./utils"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { tbtc, acreBtc, midasAllocator, midasVault } = await deployment()
  const { governance, maintainer } = await getNamedSigners()
  const [depositor, depositor2, thirdParty] = await getUnnamedSigners()

  return {
    governance,
    thirdParty,
    depositor,
    depositor2,
    maintainer,
    tbtc,
    acreBtc,
    midasAllocator,
    midasVault,
  }
}

describe("MidasAllocator", () => {
  let tbtc: TestERC20
  let acreBtc: acreBTC
  let midasAllocator: MidasAllocator
  let midasVault: MidasVaultStub

  let thirdParty: HardhatEthersSigner
  let maintainer: HardhatEthersSigner
  let governance: HardhatEthersSigner
  let acreBtcFakeSigner: HardhatEthersSigner

  before(async () => {
    ;({
      thirdParty,
      maintainer,
      governance,
      tbtc,
      acreBtc,
      midasAllocator,
      midasVault,
    } = await loadFixture(fixture))

    await acreBtc.connect(governance).updateEntryFeeBasisPoints(0)
    await acreBtc.connect(governance).updateExitFeeBasisPoints(0)

    // Impersonate acreBTC contract to be able to fake msg.sender.
    await impersonateAccount(await acreBtc.getAddress())
    acreBtcFakeSigner = await ethers.getSigner(await acreBtc.getAddress())
    await setBalance(acreBtcFakeSigner.address, to1e18(1))
  })

  after(async () => {
    await stopImpersonatingAccount(await acreBtc.getAddress())
  })

  describe("allocate", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not a maintainer", () => {
      it("should revert", async () => {
        await expect(
          midasAllocator.connect(thirdParty).allocate(),
        ).to.be.revertedWithCustomError(midasAllocator, "CallerNotMaintainer")
      })
    })

    context("when the caller is maintainer", () => {
      context("when two consecutive deposits are made", () => {
        beforeAfterSnapshotWrapper()

        context("when a first deposit is made", () => {
          let tx: ContractTransactionResponse

          before(async () => {
            await tbtc.mint(await acreBtc.getAddress(), to1e18(6))
            tx = await midasAllocator.connect(maintainer).allocate()
          })

          it("should deposit and transfer tBTC to the vault", async () => {
            await expect(tx).to.changeTokenBalances(
              tbtc,
              [await midasVault.getAddress()],
              [to1e18(6)],
            )
          })

          it("should not store any tBTC in allocator", async () => {
            expect(
              await tbtc.balanceOf(await midasAllocator.getAddress()),
            ).to.equal(0)
          })

          it("should emit DepositAllocated event", async () => {
            await expect(tx)
              .to.emit(midasAllocator, "DepositAllocated")
              .withArgs(to1e18(6), to1e18(6))
          })
        })

        context("when a second deposit is made", () => {
          let tx: ContractTransactionResponse

          before(async () => {
            await tbtc.mint(await acreBtc.getAddress(), to1e18(5))

            tx = await midasAllocator.connect(maintainer).allocate()
          })

          it("should emit DepositAllocated event", async () => {
            await expect(tx)
              .to.emit(midasAllocator, "DepositAllocated")
              .withArgs(to1e18(5), to1e18(5))
          })

          it("should deposit and transfer tBTC to vault", async () => {
            expect(
              await tbtc.balanceOf(await midasVault.getAddress()),
            ).to.equal(to1e18(11))
          })

          it("should not store any tBTC in Mezo Allocator", async () => {
            expect(
              await tbtc.balanceOf(await midasAllocator.getAddress()),
            ).to.equal(0)
          })

          it("should not store any tBTC in acreBTC", async () => {
            expect(await tbtc.balanceOf(await acreBtc.getAddress())).to.equal(0)
          })
        })
      })
    })
  })

  describe("totalAssets", () => {
    beforeAfterSnapshotWrapper()

    context("when there is no deposit", () => {
      it("should return 0", async () => {
        const totalAssets = await midasAllocator.totalAssets()
        expect(totalAssets).to.equal(0)
      })
    })

    context("when there is a deposit", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await tbtc.mint(await acreBtc.getAddress(), to1e18(5))
        await midasAllocator.connect(maintainer).allocate()
      })

      it("should return the total assets value", async () => {
        const totalAssets = await midasAllocator.totalAssets()
        expect(totalAssets).to.equal(to1e18(5))
      })
    })

    context(
      "when there is a deposit plus 'donation' to the allocator made",
      () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          await tbtc.mint(await acreBtc.getAddress(), to1e18(5))
          await midasAllocator.connect(maintainer).allocate()
          // donation
          await tbtc.mint(await midasAllocator.getAddress(), to1e18(1))
        })

        it("should return the total assets value", async () => {
          const totalAssets = await midasAllocator.totalAssets()
          expect(totalAssets).to.equal(to1e18(6))
        })
      },
    )

    context("when there is a deposit plus 'donation' to the vault made", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        await tbtc.mint(await acreBtc.getAddress(), to1e18(5))
        await midasAllocator.connect(maintainer).allocate()
        // donation
        await tbtc.mint(await midasVault.getAddress(), to1e18(1))
      })

      it("should return the total assets value", async () => {
        const totalAssets = await midasAllocator.totalAssets()
        // Use closeTo to account for rounding errors.
        expect(totalAssets).to.be.closeTo(to1e18(6), 1)
      })
    })
  })

  describe("withdrawShares", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not the withdrawal queue", () => {
      it("should revert", async () => {
        await expect(
          midasAllocator.connect(thirdParty).withdrawShares(to1e18(1)),
        ).to.be.revertedWithCustomError(midasAllocator, "NotWithdrawalQueue")
      })
    })
  })

  describe("emergencyWithdraw", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          midasAllocator.connect(thirdParty).emergencyWithdraw(),
        ).to.be.revertedWithCustomError(
          midasAllocator,
          "OwnableUnauthorizedAccount",
        )
      })
    })
  })

  describe("setWithdrawalQueue", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not the owner", () => {
      it("should revert", async () => {
        await expect(
          midasAllocator
            .connect(thirdParty)
            .setWithdrawalQueue(thirdParty.address),
        ).to.be.revertedWithCustomError(
          midasAllocator,
          "OwnableUnauthorizedAccount",
        )
      })
    })

    context("when a caller is the owner", () => {
      beforeAfterSnapshotWrapper()

      context("when the new withdrawal queue address is zero address", () => {
        it("should revert", async () => {
          await midasAllocator
            .connect(governance)
            .setWithdrawalQueue(ethers.ZeroAddress)

          expect(await midasAllocator.withdrawalQueue()).to.equal(
            ethers.ZeroAddress,
          )
        })
      })

      context(
        "when the new withdrawal queue address is not zero address",
        () => {
          it("should update the withdrawal queue address", async () => {
            await midasAllocator
              .connect(governance)
              .setWithdrawalQueue(thirdParty.address)

            expect(await midasAllocator.withdrawalQueue()).to.equal(
              thirdParty.address,
            )
          })
        },
      )
    })
  })
})
