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
  StBTC as stBTC,
  TestERC20,
  MidasAllocator,
  MidasVaultStub,
} from "../typechain"

import { to1e18 } from "./utils"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { tbtc, stbtc, midasAllocator, midasVault } = await deployment()
  const { governance, maintainer } = await getNamedSigners()
  const [depositor, depositor2, thirdParty] = await getUnnamedSigners()

  return {
    governance,
    thirdParty,
    depositor,
    depositor2,
    maintainer,
    tbtc,
    stbtc,
    midasAllocator,
    midasVault,
  }
}

describe("MidasAllocator", () => {
  let tbtc: TestERC20
  let stbtc: stBTC
  let midasAllocator: MidasAllocator
  let midasVault: MidasVaultStub

  let thirdParty: HardhatEthersSigner
  let maintainer: HardhatEthersSigner
  let governance: HardhatEthersSigner
  let stbtcFakeSigner: HardhatEthersSigner

  before(async () => {
    ;({
      thirdParty,
      maintainer,
      governance,
      tbtc,
      stbtc,
      midasAllocator,
      midasVault,
    } = await loadFixture(fixture))

    await stbtc.connect(governance).updateEntryFeeBasisPoints(0)
    await stbtc.connect(governance).updateExitFeeBasisPoints(0)

    // Impersonate stBTC contract to be able to fake msg.sender.
    await impersonateAccount(await stbtc.getAddress())
    stbtcFakeSigner = await ethers.getSigner(await stbtc.getAddress())
    await setBalance(stbtcFakeSigner.address, to1e18(1))
  })

  after(async () => {
    await stopImpersonatingAccount(await stbtc.getAddress())
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
            await tbtc.mint(await stbtc.getAddress(), to1e18(6))
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
            await tbtc.mint(await stbtc.getAddress(), to1e18(5))

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

          it("should not store any tBTC in stBTC", async () => {
            expect(await tbtc.balanceOf(await stbtc.getAddress())).to.equal(0)
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
        await tbtc.mint(await stbtc.getAddress(), to1e18(5))
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
          await tbtc.mint(await stbtc.getAddress(), to1e18(5))
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
        await tbtc.mint(await stbtc.getAddress(), to1e18(5))
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
})
