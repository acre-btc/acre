import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect } from "chai"
import { ContractTransactionResponse, encodeBytes32String } from "ethers"
import { ethers, helpers } from "hardhat"

import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"

import { to1e18 } from "./utils"

import type {
  AcreBTC as acreBTC,
  BitcoinRedeemerV2,
  MidasAllocator,
  TestTBTC,
} from "../typechain"
import { tbtcRedemptionData } from "./data/tbtc"

const { impersonateAccount } = helpers.account
const { getNamedSigners, getUnnamedSigners } = helpers.signers

async function fixture() {
  const { tbtc, acreBtc, bitcoinRedeemerV2, midasAllocator } =
    await deployment()

  const { deployer, governance, maintainer } = await getNamedSigners()
  const [thirdParty, depositor2] = await getUnnamedSigners()

  // Impersonate the tbtcRedemptionData.redeemer account to match the redemption
  // test data.
  await impersonateAccount(tbtcRedemptionData.redeemer, {
    from: deployer,
  })
  const depositor1 = await ethers.getSigner(tbtcRedemptionData.redeemer)

  const amountToMint = to1e18(100000)
  await tbtc.mint(depositor1, amountToMint)
  await tbtc.mint(depositor2, amountToMint)

  return {
    acreBtc,
    tbtc,
    bitcoinRedeemer: bitcoinRedeemerV2,
    midasAllocator,
    governance,
    maintainer,
    depositor1,
    depositor2,
    thirdParty,
  }
}

describe("BitcoinRedeemerV2", () => {
  let acreBtc: acreBTC
  let tbtc: TestTBTC
  let bitcoinRedeemer: BitcoinRedeemerV2
  let midasAllocator: MidasAllocator

  let governance: HardhatEthersSigner
  let maintainer: HardhatEthersSigner
  let depositor1: HardhatEthersSigner
  let depositor2: HardhatEthersSigner
  let thirdParty: HardhatEthersSigner

  before(async () => {
    ;({
      acreBtc,
      tbtc,
      bitcoinRedeemer,
      midasAllocator,
      governance,
      maintainer,
      depositor1,
      depositor2,
      thirdParty,
    } = await loadFixture(fixture))

    await acreBtc.connect(governance).updateEntryFeeBasisPoints(0)
    await acreBtc.connect(governance).updateExitFeeBasisPoints(0)
  })

  describe("receiveApproval", () => {
    beforeAfterSnapshotWrapper()

    const depositAmount1 = to1e18(10)
    const depositAmount2 = to1e18(5)
    const earnedYield = to1e18(8)

    before(async () => {
      await tbtc
        .connect(depositor1)
        .approve(await acreBtc.getAddress(), depositAmount1)
      await acreBtc
        .connect(depositor1)
        .deposit(depositAmount1, depositor1.address)

      await tbtc
        .connect(depositor2)
        .approve(await acreBtc.getAddress(), depositAmount2)
      await acreBtc
        .connect(depositor2)
        .deposit(depositAmount2, depositor2.address)

      await tbtc.mint(await acreBtc.getAddress(), earnedYield)

      await midasAllocator.connect(maintainer).allocate()
    })

    context("when called not for acreBTC token", () => {
      it("should revert", async () => {
        await expect(
          bitcoinRedeemer
            .connect(depositor1)
            .receiveApproval(
              depositor1.address,
              to1e18(1),
              depositor1.address,
              encodeBytes32String(""),
            ),
        ).to.be.revertedWithCustomError(bitcoinRedeemer, "CallerNotAllowed")
      })
    })

    context("when called directly", () => {
      it("should revert", async () => {
        await expect(
          bitcoinRedeemer
            .connect(depositor1)
            .receiveApproval(
              depositor1.address,
              to1e18(1),
              await acreBtc.getAddress(),
              encodeBytes32String(""),
            ),
        ).to.be.revertedWithCustomError(bitcoinRedeemer, "CallerNotAllowed")
      })
    })

    context("when called via approveAndCall", () => {
      context("when called with empty extraData", () => {
        it("should revert", async () => {
          await expect(
            acreBtc
              .connect(depositor1)
              .approveAndCall(
                await bitcoinRedeemer.getAddress(),
                to1e18(1),
                "0x",
              ),
          ).to.be.revertedWithCustomError(bitcoinRedeemer, "EmptyExtraData")
        })
      })

      context("when called with non-empty extraData", () => {
        context("when caller has no deposit", () => {
          it("should revert", async () => {
            await expect(
              acreBtc
                .connect(thirdParty)
                .approveAndCall(
                  await bitcoinRedeemer.getAddress(),
                  to1e18(1),
                  tbtcRedemptionData.redemptionData.replace(
                    depositor1.address.toLowerCase().slice(2),
                    thirdParty.address.toLowerCase().slice(2),
                  ),
                ),
            )
              .to.be.revertedWithCustomError(
                acreBtc,
                "ERC20InsufficientBalance",
              )
              .withArgs(thirdParty.address, 0, to1e18(1))
          })
        })

        context("when caller has deposit", () => {
          beforeAfterSnapshotWrapper()

          context("when redeemer doesn't match token owner", () => {
            it("should revert", async () => {
              // Replace the redeemer address in the redemption data.
              const invalidRedemptionData =
                tbtcRedemptionData.redemptionData.replace(
                  depositor1.address.toLowerCase().slice(2),
                  depositor2.address.toLowerCase().slice(2),
                )

              await expect(
                acreBtc
                  .connect(depositor1)
                  .approveAndCall(
                    await bitcoinRedeemer.getAddress(),
                    depositAmount1,
                    invalidRedemptionData,
                  ),
              )
                .to.be.revertedWithCustomError(
                  bitcoinRedeemer,
                  "RedeemerNotOwner",
                )
                .withArgs(depositor2.address, depositor1.address)
            })
          })

          context("when redeeming too many tokens", () => {
            const amountToRedeem = depositAmount1 + 1n

            it("should revert", async () => {
              await expect(
                acreBtc
                  .connect(depositor1)
                  .approveAndCall(
                    await bitcoinRedeemer.getAddress(),
                    amountToRedeem,
                    tbtcRedemptionData.redemptionData,
                  ),
              )
                .to.be.revertedWithCustomError(
                  acreBtc,
                  "ERC20InsufficientBalance",
                )
                .withArgs(depositor1.address, depositAmount1, amountToRedeem)
            })
          })

          context("when redemption succeeds", () => {
            beforeAfterSnapshotWrapper()

            context("when redeeming deposit fully", () => {
              beforeAfterSnapshotWrapper()

              const acreBtcAmountToRedeem = depositAmount1
              const expectedRequestId = 1n

              let tx: ContractTransactionResponse

              before(async () => {
                tx = await acreBtc
                  .connect(depositor1)
                  .approveAndCall(
                    await bitcoinRedeemer.getAddress(),
                    acreBtcAmountToRedeem,
                    tbtcRedemptionData.redemptionData,
                  )
              })

              it("should emit RedemptionRequested event", async () => {
                await expect(tx)
                  .to.emit(bitcoinRedeemer, "RedemptionRequested")
                  .withArgs(
                    depositor1.address,
                    expectedRequestId,
                    acreBtcAmountToRedeem,
                  )
              })

              it("should change acreBTC tokens balance", async () => {
                await expect(tx).to.changeTokenBalances(
                  acreBtc,
                  [depositor1],
                  [-acreBtcAmountToRedeem],
                )
              })

              it("should burn acreBTC tokens", async () => {
                expect(await acreBtc.totalSupply()).to.be.equal(
                  depositAmount1 + depositAmount2 - acreBtcAmountToRedeem,
                )
              })

              it("should transfer acreBTC tokens from the depositor", async () => {
                await expect(tx).to.changeTokenBalances(
                  acreBtc,
                  [depositor1],
                  [-acreBtcAmountToRedeem],
                )
              })

              it("should leave no remainder acreBTC tokens for depositor", async () => {
                expect(await acreBtc.balanceOf(depositor1)).to.be.equal(0)
              })

              it("should call requestRedeemAndBridge in acreBTC contract", async () => {
                await expect(tx)
                  .to.emit(acreBtc, "RedemptionToBitcoinRequested")
                  .withArgs(
                    1,
                    depositor1.address,
                    await bitcoinRedeemer.getAddress(),
                    acreBtcAmountToRedeem,
                  )
              })
            })

            context("when redeeming deposit partially", () => {
              beforeAfterSnapshotWrapper()

              const acreBtcAmountToRedeem = to1e18(6)
              const expectedRequestId = 1n
              const expectedRemainingAmount = to1e18(4)

              let tx: ContractTransactionResponse

              before(async () => {
                tx = await acreBtc
                  .connect(depositor1)
                  .approveAndCall(
                    await bitcoinRedeemer.getAddress(),
                    acreBtcAmountToRedeem,
                    tbtcRedemptionData.redemptionData,
                  )
              })

              it("should emit RedemptionRequested event", async () => {
                await expect(tx)
                  .to.emit(bitcoinRedeemer, "RedemptionRequested")
                  .withArgs(
                    depositor1.address,
                    expectedRequestId,
                    acreBtcAmountToRedeem,
                  )
              })

              it("should change acreBTC tokens balance", async () => {
                await expect(tx).to.changeTokenBalances(
                  acreBtc,
                  [depositor1],
                  [-acreBtcAmountToRedeem],
                )
              })

              it("should burn acreBTC tokens", async () => {
                expect(await acreBtc.totalSupply()).to.be.equal(
                  depositAmount1 + depositAmount2 - acreBtcAmountToRedeem,
                )
              })

              it("should transfer acreBTC tokens from the depositor", async () => {
                await expect(tx).to.changeTokenBalances(
                  acreBtc,
                  [depositor1],
                  [-acreBtcAmountToRedeem],
                )
              })

              it("should leave remainder acreBTC tokens", async () => {
                expect(await acreBtc.balanceOf(depositor1)).to.be.equal(
                  expectedRemainingAmount,
                )
              })

              it("should call requestRedeemAndBridge in acreBTC contract", async () => {
                await expect(tx)
                  .to.emit(acreBtc, "RedemptionToBitcoinRequested")
                  .withArgs(
                    1,
                    depositor1.address,
                    await bitcoinRedeemer.getAddress(),
                    acreBtcAmountToRedeem,
                  )
              })
            })
          })
        })
      })
    })
  })
})
