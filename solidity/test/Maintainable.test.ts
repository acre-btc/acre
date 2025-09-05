import { helpers, ethers, upgrades } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { expect } from "chai"

import { ContractTransactionResponse, ZeroAddress } from "ethers"
import { beforeAfterSnapshotWrapper } from "./helpers"

import { type TestMaintainable } from "../typechain/contracts/test/TestMaintainable"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

describe("Maintainable", () => {
  let maintainable: TestMaintainable

  let thirdParty: HardhatEthersSigner

  let maintainer: HardhatEthersSigner
  let governance: HardhatEthersSigner

  before(async () => {
    let deployer: HardhatEthersSigner
    ;({ deployer, governance, maintainer } = await getNamedSigners())
    ;[maintainer, thirdParty] = await getUnnamedSigners()

    const maintainableFactory = await ethers.getContractFactory(
      "TestMaintainable",
      { signer: deployer },
    )
    maintainable = (await upgrades.deployProxy(maintainableFactory, [], {
      kind: "transparent",
    })) as unknown as TestMaintainable

    await maintainable.connect(deployer).transferOwnership(governance.address)
    await maintainable.connect(governance).acceptOwnership()

    await maintainable.connect(governance).addMaintainer(maintainer.address)
  })

  describe("addMaintainer", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not a governance", () => {
      it("should revert", async () => {
        await expect(
          maintainable.connect(thirdParty).addMaintainer(thirdParty.address),
        ).to.be.revertedWithCustomError(
          maintainable,
          "OwnableUnauthorizedAccount",
        )
      })
    })

    context("when a caller is governance", () => {
      context("when a maintainer is added", () => {
        let tx: ContractTransactionResponse

        before(async () => {
          tx = await maintainable
            .connect(governance)
            .addMaintainer(thirdParty.address)
        })

        it("should add a maintainer", async () => {
          expect(await maintainable.isMaintainer(thirdParty.address)).to.equal(
            true,
          )
        })

        it("should emit MaintainerAdded event", async () => {
          await expect(tx)
            .to.emit(maintainable, "MaintainerAdded")
            .withArgs(thirdParty.address)
        })

        it("should add a new maintainer to the list", async () => {
          const maintainers = await maintainable.getMaintainers()
          expect(maintainers).to.deep.equal([
            maintainer.address,
            thirdParty.address,
          ])
        })

        it("should not allow to add the same maintainer twice", async () => {
          await expect(
            maintainable.connect(governance).addMaintainer(thirdParty.address),
          ).to.be.revertedWithCustomError(
            maintainable,
            "MaintainerAlreadyRegistered",
          )
        })

        it("should not allow to add a zero address as a maintainer", async () => {
          await expect(
            maintainable.connect(governance).addMaintainer(ZeroAddress),
          ).to.be.revertedWithCustomError(maintainable, "ZeroAddress")
        })
      })
    })
  })

  describe("removeMaintainer", () => {
    beforeAfterSnapshotWrapper()

    context("when a caller is not a governance", () => {
      it("should revert", async () => {
        await expect(
          maintainable.connect(thirdParty).removeMaintainer(maintainer.address),
        ).to.be.revertedWithCustomError(
          maintainable,
          "OwnableUnauthorizedAccount",
        )
      })
    })

    context("when a caller is governance", () => {
      context("when a maintainer is removed", () => {
        let tx: ContractTransactionResponse

        before(async () => {
          await maintainable
            .connect(governance)
            .addMaintainer(thirdParty.address)
          tx = await maintainable
            .connect(governance)
            .removeMaintainer(thirdParty.address)
        })

        it("should remove a maintainer", async () => {
          expect(await maintainable.isMaintainer(thirdParty.address)).to.equal(
            false,
          )
        })

        it("should emit MaintainerRemoved event", async () => {
          await expect(tx)
            .to.emit(maintainable, "MaintainerRemoved")
            .withArgs(thirdParty.address)
        })

        it("should remove a maintainer from the list", async () => {
          const maintainers = await maintainable.getMaintainers()
          expect(maintainers).to.deep.equal([maintainer.address])
        })

        it("should not allow to remove a maintainer twice", async () => {
          await expect(
            maintainable
              .connect(governance)
              .removeMaintainer(thirdParty.address),
          ).to.be.revertedWithCustomError(
            maintainable,
            "MaintainerNotRegistered",
          )
        })
      })
    })
  })
})
