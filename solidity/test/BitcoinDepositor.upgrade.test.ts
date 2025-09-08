import chaiAsPromised from "chai-as-promised"
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import { expect, use } from "chai"
import { helpers } from "hardhat"
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"
import { ContractTransactionResponse } from "ethers"
import { beforeAfterSnapshotWrapper, deployment } from "./helpers"
import {
  TestERC20,
  AcreBTC as acreBTC,
  BitcoinDepositor,
  BridgeStub,
  TBTCVaultStub,
  BitcoinDepositorV2,
} from "../typechain"
import { to1e18 } from "./utils"

use(chaiAsPromised)

async function fixture() {
  const { tbtc, acreBtc, bitcoinDepositor, tbtcBridge, tbtcVault } =
    await deployment()

  return { tbtc, acreBtc, bitcoinDepositor, tbtcBridge, tbtcVault }
}

describe("BitcoinDepositor contract upgrade", () => {
  let tbtc: TestERC20
  let tbtcBridge: BridgeStub
  let tbtcVault: TBTCVaultStub
  let acreBtc: acreBTC
  let bitcoinDepositor: BitcoinDepositor
  let governance: HardhatEthersSigner

  before(async () => {
    ;({ tbtc, acreBtc, bitcoinDepositor, tbtcBridge, tbtcVault } =
      await loadFixture(fixture))
    ;({ governance } = await helpers.signers.getNamedSigners())
  })

  context("when upgrading to a valid contract", () => {
    const newVariable = 1n
    let bitcoinDepositorV2: BitcoinDepositorV2
    let v1InitialParameters: {
      minDepositAmount: bigint
      depositorFeeDivisor: bigint
    }

    beforeAfterSnapshotWrapper()

    before(async () => {
      const minDepositAmount = await bitcoinDepositor.minDepositAmount()

      const depositorFeeDivisor = await bitcoinDepositor.depositorFeeDivisor()

      v1InitialParameters = {
        minDepositAmount,
        depositorFeeDivisor,
      }

      const [upgradedDepositor] = await helpers.upgrades.upgradeProxy(
        "BitcoinDepositor",
        "BitcoinDepositorV2",
        {
          factoryOpts: { signer: governance },
          proxyOpts: {
            call: {
              fn: "initializeV2",
              args: [newVariable],
            },
          },
        },
      )

      bitcoinDepositorV2 = upgradedDepositor as unknown as BitcoinDepositorV2
    })

    it("new instance should have the same address as the old one", async () => {
      expect(await bitcoinDepositorV2.getAddress()).to.equal(
        await bitcoinDepositor.getAddress(),
      )
    })

    describe("contract variables", () => {
      it("should initialize new variable correctly", async () => {
        expect(await bitcoinDepositorV2.newVariable()).to.eq(newVariable)
      })

      it("should keep v1 initial parameters", async () => {
        expect(await bitcoinDepositorV2.bridge()).to.eq(
          await tbtcBridge.getAddress(),
        )
        expect(await bitcoinDepositorV2.tbtcVault()).to.eq(
          await tbtcVault.getAddress(),
        )
        expect(await bitcoinDepositorV2.tbtcToken()).to.eq(
          await tbtc.getAddress(),
        )
        expect(await bitcoinDepositorV2.acreVault()).to.eq(
          await acreBtc.getAddress(),
        )

        expect(await bitcoinDepositorV2.minDepositAmount()).to.eq(
          v1InitialParameters.minDepositAmount,
        )
        expect(await bitcoinDepositorV2.depositorFeeDivisor()).to.eq(
          v1InitialParameters.depositorFeeDivisor,
        )
      })
    })

    describe("upgraded `updateMinDepositAmount` function", () => {
      const newMinDepositAmount: bigint = to1e18(1000)
      let tx: ContractTransactionResponse

      before(async () => {
        tx = await bitcoinDepositorV2
          .connect(governance)
          .updateMinDepositAmount(newMinDepositAmount)
      })

      it("should emit `NewEvent` event", async () => {
        await expect(tx).to.emit(bitcoinDepositorV2, "NewEvent")
      })
    })
  })
})
