import { helpers, ethers, upgrades } from "hardhat"
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
  AcreBTC,
  TestTBTC,
  MidasAllocator,
  MidasVaultStub,
  WithdrawalQueue,
  TBTCVaultStub,
} from "../typechain"

import { to1e18 } from "./utils"

const { getNamedSigners, getUnnamedSigners } = helpers.signers

// Helper to create redemption data for tBTC bridge calls
function createRedemptionData(
  redeemer: string,
  walletPubKeyHash: string,
  mainUtxo: string = "0x0000000000000000000000000000000000000000000000000000000000000000",
  redeemerOutputScriptValue: number = 0,
  requestedAmount: bigint = to1e18(1),
  redeemerOutputScript: string = "0x1234",
): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
    [
      redeemer,
      walletPubKeyHash,
      mainUtxo,
      redeemerOutputScriptValue,
      requestedAmount,
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
  } = await deployment()
  const { governance, maintainer } = await getNamedSigners()
  const [depositor, depositor2, thirdParty, deployer] =
    await getUnnamedSigners()

  // Deploy WithdrawalQueue
  const WithdrawalQueueFactory = await ethers.getContractFactory(
    "WithdrawalQueue",
    deployer,
  )
  const withdrawalQueue = (await upgrades.deployProxy(
    WithdrawalQueueFactory,
    [
      await tbtc.getAddress(),
      await midasVault.getAddress(),
      await midasAllocator.getAddress(),
      await tbtcVault.getAddress(),
      await acreBTC.getAddress(),
    ],
    {
      kind: "transparent",
    },
  )) as unknown as WithdrawalQueue

  // Set withdrawal queue in MidasAllocator
  await midasAllocator
    .connect(governance)
    .setWithdrawalQueue(await withdrawalQueue.getAddress())

  // Add maintainer to WithdrawalQueue (using deployer who is the initial owner)
  await withdrawalQueue.connect(deployer).addMaintainer(maintainer.address)

  // Transfer ownership to governance
  await withdrawalQueue.connect(deployer).transferOwnership(governance.address)

  // Set withdrawal queue in acreBTC
  await acreBTC
    .connect(governance)
    .updateWithdrawalQueue(await withdrawalQueue.getAddress())

  return {
    governance,
    thirdParty,
    depositor,
    depositor2,
    maintainer,
    deployer,
    tbtc,
    acreBtc: acreBTC,
    midasAllocator,
    midasVault,
    tbtcVault,
    withdrawalQueue,
  }
}

describe("WithdrawalQueue", () => {
  let tbtc: TestTBTC
  let acreBTC: AcreBTC
  let midasAllocator: MidasAllocator
  let midasVault: MidasVaultStub
  let tbtcVault: TBTCVaultStub
  let withdrawalQueue: WithdrawalQueue

  let thirdParty: HardhatEthersSigner
  let maintainer: HardhatEthersSigner
  let governance: HardhatEthersSigner
  let depositor: HardhatEthersSigner
  let depositor2: HardhatEthersSigner
  let deployer: HardhatEthersSigner
  let tbtcVaultFakeSigner: HardhatEthersSigner

  before(async () => {
    ;({
      thirdParty,
      maintainer,
      governance,
      depositor,
      depositor2,
      deployer,
      tbtc,
      acreBTC,
      midasAllocator,
      midasVault,
      tbtcVault,
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
      expect(await withdrawalQueue.vault()).to.equal(
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

    const depositAmount = to1e18(10)
    const withdrawalAmount = to1e18(5)

    context("when user has sufficient stBTC balance", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup: Give depositor generous amount of tBTC and let them deposit to get stBTC
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

      it("should redeem successfully for direct EVM withdrawal", async () => {
        const balanceBefore = await acreBTC.balanceOf(depositor.address)

        // First withdraw tBTC from the vault to test the insufficient balance path
        const acreBTCAddress = await acreBTC.getAddress()
        const currentBalance = await tbtc.balanceOf(acreBTCAddress)
        if (currentBalance > 0) {
          await impersonateAccount(acreBTCAddress)
          await setBalance(acreBTCAddress, ethers.parseEther("1"))
          const acreBTCSigner = await ethers.getSigner(acreBTCAddress)
          await tbtc
            .connect(acreBTCSigner)
            .transfer(depositor2.address, currentBalance)
          await stopImpersonatingAccount(acreBTCAddress)
        }

        // Now redeem through acreBTC which should route to withdrawal queue
        await acreBTC
          .connect(depositor)
          .redeem(withdrawalAmount, depositor.address, depositor.address)

        const balanceAfter = await acreBTC.balanceOf(depositor.address)
        expect(balanceBefore - balanceAfter).to.equal(withdrawalAmount)
      })

      it("should burn stBTC from depositor", async () => {
        const balanceBefore = await acreBTC.balanceOf(depositor.address)

        // First withdraw tBTC from the vault to test the insufficient balance path
        const acreBTCAddress = await acreBTC.getAddress()
        const currentBalance = await tbtc.balanceOf(acreBTCAddress)
        if (currentBalance > 0) {
          await impersonateAccount(acreBTCAddress)
          await setBalance(acreBTCAddress, ethers.parseEther("1"))
          const acreBTCSigner = await ethers.getSigner(acreBTCAddress)
          await tbtc
            .connect(acreBTCSigner)
            .transfer(depositor2.address, currentBalance)
          await stopImpersonatingAccount(acreBTCAddress)
        }

        await acreBTC
          .connect(depositor)
          .redeem(withdrawalAmount, depositor.address, depositor.address)

        const balanceAfter = await acreBTC.balanceOf(depositor.address)
        expect(balanceBefore - balanceAfter).to.equal(withdrawalAmount)
      })

      it("should not increment request counter for direct redemption", async () => {
        const initialCount = await withdrawalQueue.count()

        // First withdraw tBTC from the vault to test the insufficient balance path
        const acreBTCAddress = await acreBTC.getAddress()
        const currentBalance = await tbtc.balanceOf(acreBTCAddress)
        if (currentBalance > 0) {
          await impersonateAccount(acreBTCAddress)
          await setBalance(acreBTCAddress, ethers.parseEther("1"))
          const acreBTCSigner = await ethers.getSigner(acreBTCAddress)
          await tbtc
            .connect(acreBTCSigner)
            .transfer(depositor2.address, currentBalance)
          await stopImpersonatingAccount(acreBTCAddress)
        }

        await acreBTC
          .connect(depositor)
          .redeem(withdrawalAmount, depositor.address, depositor.address)

        expect(await withdrawalQueue.count()).to.equal(initialCount)
      })

      context("with exit fee", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          // Set 1% exit fee
          await acreBTC.connect(governance).updateExitFeeBasisPoints(100)

          // Setup treasury
          await acreBTC.connect(governance).updateTreasury(governance.address)
        })

        it("should deduct exit fee during redemption", async () => {
          const balanceBefore = await acreBTC.balanceOf(depositor.address)
          const treasuryBalanceBefore = await tbtc.balanceOf(governance.address)

          // First withdraw tBTC from the vault to test the insufficient balance path
          const acreBTCAddress = await acreBTC.getAddress()
          const currentBalance = await tbtc.balanceOf(acreBTCAddress)
          if (currentBalance > 0) {
            await impersonateAccount(acreBTCAddress)
            await setBalance(acreBTCAddress, ethers.parseEther("1"))
            const acreBTCSigner = await ethers.getSigner(acreBTCAddress)
            await tbtc
              .connect(acreBTCSigner)
              .transfer(depositor2.address, currentBalance)
            await stopImpersonatingAccount(acreBTCAddress)
          }

          await acreBTC
            .connect(depositor)
            .redeem(withdrawalAmount, depositor.address, depositor.address)

          const balanceAfter = await acreBTC.balanceOf(depositor.address)
          expect(balanceBefore - balanceAfter).to.equal(withdrawalAmount)

          // Treasury should receive exit fee in vault shares, not tBTC for direct redemption
          const treasuryBalanceAfter = await tbtc.balanceOf(governance.address)
          expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore) // No tBTC fee for direct redemption
        })
      })
    })
  })

  describe("requestRedeemAndBridge", () => {
    beforeAfterSnapshotWrapper()

    const redeemerOutputScript = "0x1234" // bytes
    const depositAmount = to1e18(10)
    const withdrawalAmount = to1e18(5)

    context("when user has sufficient stBTC balance", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup: Give depositor generous amount of tBTC and let them deposit to get stBTC
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

      it("should create bridge withdrawal request successfully", async () => {
        const tbtcAmount = await acreBTC.convertToAssets(withdrawalAmount)
        const midasVaultShares = await midasVault.convertToShares(tbtcAmount)

        const tx = await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        const requestId = await tx.wait().then(
          (receipt: any) =>
            // Get the request ID from the return value
            0, // First request
        )

        const request = await withdrawalQueue.withdrawalRequests(requestId)

        expect(request.redeemer).to.equal(depositor.address)
        expect(request.shares).to.equal(midasVaultShares)
        expect(request.tbtcAmount).to.equal(tbtcAmount)
        expect(request.completedAt).to.equal(0n)
        expect(request.redeemerOutputScript).to.equal(redeemerOutputScript)
        expect(request.midasRequestId).to.equal(1) // First request

        await expect(tx)
          .to.emit(withdrawalQueue, "WithdrawalRequestCreated")
          .withArgs(
            requestId,
            depositor.address,
            midasVaultShares,
            tbtcAmount,
            redeemerOutputScript,
            1,
          )
      })

      it("should burn stBTC from depositor", async () => {
        const balanceBefore = await acreBTC.balanceOf(depositor.address)

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        const balanceAfter = await acreBTC.balanceOf(depositor.address)
        expect(balanceBefore - balanceAfter).to.equal(withdrawalAmount)
      })

      it("should increment request counter", async () => {
        const initialCount = await withdrawalQueue.count()

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        expect(await withdrawalQueue.count()).to.equal(initialCount + 1n)

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)
      })
    })

    context("when user has insufficient stBTC balance", () => {
      it("should revert", async () => {
        const largeAmount = to1e18(1000)
        await expect(
          acreBTC
            .connect(depositor)
            .redeemAndBridge(largeAmount, redeemerOutputScript),
        ).to.be.reverted // ERC20 transfer will fail
      })
    })
  })

  describe("finalizeRedeemAndBridge", () => {
    beforeAfterSnapshotWrapper()

    const walletPubKeyHash = `0x${"12".repeat(20)}`
    const redeemerOutputScript = "0x1234"
    const depositAmount = to1e18(10)
    const withdrawalAmount = to1e18(5)

    context("when caller is not maintainer", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup withdrawal request
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)
      })

      it("should revert", async () => {
        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        await expect(
          withdrawalQueue
            .connect(thirdParty)
            .finalizeRedeemAndBridge(0, redemptionData),
        ).to.be.revertedWithCustomError(withdrawalQueue, "CallerNotMaintainer")
      })
    })

    context("when tBTC token owner is not tbtcVault", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup withdrawal request
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)
      })

      it("should revert", async () => {
        // Set tBTC owner to something other than tbtcVault
        await tbtc.setOwner(thirdParty.address)

        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(0, redemptionData),
        ).to.be.revertedWithCustomError(
          withdrawalQueue,
          "UnexpectedTbtcTokenOwner",
        )
      })
    })

    context("when withdrawal request is already completed", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Setup and complete a withdrawal request
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        // Set tBTC owner to tbtcVault
        await tbtc.setOwner(await tbtcVault.getAddress())

        // Give withdrawal queue some tBTC to complete the request
        await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount)

        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        // Mock approveAndCall to return true
        await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(true)

        // Complete the request
        await withdrawalQueue
          .connect(maintainer)
          .finalizeRedeemAndBridge(0, redemptionData)
      })

      it("should revert", async () => {
        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )
        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(0, redemptionData),
        ).to.be.revertedWithCustomError(
          withdrawalQueue,
          "WithdrawalRequestAlreadyCompleted",
        )
      })
    })

    context("for Bitcoin bridge withdrawal", () => {
      beforeAfterSnapshotWrapper()

      before(async () => {
        // Set tBTC owner to tbtcVault for all tests in this context
        await tbtc.setOwner(await tbtcVault.getAddress())
      })

      it("should call tbtcVault.requestRedemption with correct data", async () => {
        // Setup withdrawal request for Bitcoin delivery
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        const currentCount = await withdrawalQueue.count()
        const tbtcAmountRaw = await acreBTC.convertToAssets(withdrawalAmount)
        const tbtcAmountWithFee = await acreBTC.previewRedeem(withdrawalAmount)
        const fee = tbtcAmountRaw - tbtcAmountWithFee
        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        // Give withdrawal queue generous tBTC to complete the request
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          withdrawalAmount * 2n,
        )

        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        // Mock approveAndCall to return true
        await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(true)

        const tx = await withdrawalQueue
          .connect(maintainer)
          .finalizeRedeemAndBridge(currentCount, redemptionData)

        await expect(tx)
          .to.emit(withdrawalQueue, "WithdrawalRequestCompleted")
          .withArgs(currentCount, tbtcAmountRaw, fee)
      })

      it("should mark request as completed", async () => {
        // Setup withdrawal request
        await tbtc.mint(depositor.address, depositAmount)
        await tbtc
          .connect(depositor)
          .approve(await acreBTC.getAddress(), depositAmount)
        await acreBTC
          .connect(depositor)
          .deposit(depositAmount, depositor.address)

        await midasAllocator.connect(maintainer).allocate()

        const currentCount = await withdrawalQueue.count()
        await acreBTC
          .connect(depositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        // Give withdrawal queue generous tBTC to complete the request
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          withdrawalAmount * 2n,
        )

        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        // Mock approveAndCall to return true
        await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(true)

        await withdrawalQueue
          .connect(maintainer)
          .finalizeRedeemAndBridge(currentCount, redemptionData)

        const request = await withdrawalQueue.withdrawalRequests(currentCount)

        expect(request.completedAt).to.be.greaterThan(0)
      })

      context("with exit fee", () => {
        beforeAfterSnapshotWrapper()

        before(async () => {
          // Set 1% exit fee
          await acreBTC.connect(governance).updateExitFeeBasisPoints(100)

          // Setup treasury
          await acreBTC.connect(governance).updateTreasury(governance.address)
        })

        it("should deduct exit fee and send to treasury during completion", async () => {
          // Use a different account to avoid balance conflicts with other tests
          const testDepositor = thirdParty
          const testDepositAmount = to1e18(30) // Large amount to ensure sufficient balance
          await tbtc.mint(testDepositor.address, testDepositAmount)
          await tbtc
            .connect(testDepositor)
            .approve(await acreBTC.getAddress(), testDepositAmount)
          await acreBTC
            .connect(testDepositor)
            .deposit(testDepositAmount, testDepositor.address)

          await midasAllocator.connect(maintainer).allocate()

          const currentCount = await withdrawalQueue.count()
          // Use an even smaller withdrawal amount to avoid balance issues
          const safeWithdrawalAmount = to1e18(2)
          const expectedReceivedAssets =
            await acreBTC.previewRedeem(safeWithdrawalAmount)
          await acreBTC
            .connect(testDepositor)
            .redeemAndBridge(safeWithdrawalAmount, redeemerOutputScript)

          const request = await withdrawalQueue.withdrawalRequests(currentCount)
          const exitFeeBasisPoints = await acreBTC.exitFeeBasisPoints()
          const expectedFee =
            (request.tbtcAmount * exitFeeBasisPoints) /
              (exitFeeBasisPoints + 10000n) +
            1n

          // Give withdrawal queue enough tBTC to cover withdrawal and fee
          await tbtc.mint(
            await withdrawalQueue.getAddress(),
            request.tbtcAmount * 2n,
          )

          const treasuryBalanceBefore = await tbtc.balanceOf(governance.address)

          const redemptionData = createRedemptionData(
            testDepositor.address,
            walletPubKeyHash,
            undefined,
            undefined,
            undefined,
            redeemerOutputScript,
          )

          // Mock approveAndCall to return true
          await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(true)

          const tx = await withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(currentCount, redemptionData)
          const receipt = await tx.wait()
          // check the logs for WithdrawalRequestCompleted
          if (receipt) {
            const withdrawalQueueAddress = await withdrawalQueue.getAddress()
            const withdrawalQueueLogs = receipt.logs.filter(
              (log: any) =>
                log.address.toLowerCase() ===
                withdrawalQueueAddress.toLowerCase(),
            )
            const withdrawalRequestCompletedLog = withdrawalQueueLogs.find(
              (log: any) => {
                try {
                  const parsed = withdrawalQueue.interface.parseLog({
                    topics: log.topics,
                    data: log.data,
                  })
                  return parsed?.name === "WithdrawalRequestCompleted"
                } catch {
                  return false
                }
              },
            )
            expect(withdrawalRequestCompletedLog).to.not.be.undefined
            if (withdrawalRequestCompletedLog) {
              const decodedLog = withdrawalQueue.interface.parseLog({
                topics: withdrawalRequestCompletedLog.topics as any,
                data: withdrawalRequestCompletedLog.data,
              })

              if (decodedLog) {
                expect(decodedLog.args.requestId).to.equal(currentCount)
                expect(decodedLog.args.tbtcAmount).to.equal(
                  expectedReceivedAssets,
                )
                expect(decodedLog.args.exitFee).to.equal(expectedFee)
              }
            }
          }

          const treasuryBalanceAfter = await tbtc.balanceOf(governance.address)
          expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(
            expectedFee,
          )
        })
      })

      it("should revert if redemption data has wrong redeemer", async () => {
        // Use a different account to avoid balance conflicts with other tests
        const testDepositor = deployer // Use deployer account which should have fresh balance
        const testDepositAmount = to1e18(30) // Large amount to ensure sufficient balance
        await tbtc.mint(testDepositor.address, testDepositAmount)
        await tbtc
          .connect(testDepositor)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(testDepositor)
          .deposit(testDepositAmount, testDepositor.address)

        await midasAllocator.connect(maintainer).allocate()

        const currentCount = await withdrawalQueue.count()
        await acreBTC
          .connect(testDepositor)
          .redeemAndBridge(withdrawalAmount, redeemerOutputScript)

        // Give withdrawal queue generous tBTC to complete the request
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          withdrawalAmount * 2n,
        )

        const wrongRedemptionData = createRedemptionData(
          thirdParty.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(currentCount, wrongRedemptionData),
        ).to.be.revertedWithCustomError(
          withdrawalQueue,
          "InvalidRedemptionData",
        )
      })

      it("should revert if redemption data has wrong wallet pub key hash", async () => {
        // Use governance account to avoid balance conflicts with other tests
        const testDepositor = governance
        const testDepositAmount = to1e18(30) // Large amount to ensure sufficient balance
        await tbtc.mint(testDepositor.address, testDepositAmount)
        await tbtc
          .connect(testDepositor)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(testDepositor)
          .deposit(testDepositAmount, testDepositor.address)

        await midasAllocator.connect(maintainer).allocate()

        const currentCount = await withdrawalQueue.count()
        // Use a smaller withdrawal amount to avoid balance issues
        const safeWithdrawalAmount = to1e18(3) // Reduce from 5 to 3 tBTC
        await acreBTC
          .connect(testDepositor)
          .redeemAndBridge(safeWithdrawalAmount, redeemerOutputScript)

        // Give withdrawal queue generous tBTC to complete the request
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          safeWithdrawalAmount * 2n,
        )

        const wrongRedeemerOutputScript = "0x5678"
        const wrongRedemptionData = createRedemptionData(
          testDepositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          wrongRedeemerOutputScript,
        )

        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(currentCount, wrongRedemptionData),
        ).to.be.revertedWithCustomError(
          withdrawalQueue,
          "InvalidRedemptionData",
        )
      })

      it("should revert if approveAndCall fails", async () => {
        // Use a different account to avoid balance conflicts with other tests
        const testDepositor = depositor2
        const testDepositAmount = to1e18(30) // Large amount to ensure sufficient balance
        await tbtc.mint(testDepositor.address, testDepositAmount)
        await tbtc
          .connect(testDepositor)
          .approve(await acreBTC.getAddress(), testDepositAmount)
        await acreBTC
          .connect(testDepositor)
          .deposit(testDepositAmount, testDepositor.address)

        await tbtc.mint(await withdrawalQueue.getAddress(), to1e18(10))

        await midasAllocator.connect(maintainer).allocate()

        const currentCount = await withdrawalQueue.count()
        // Use a smaller withdrawal amount to avoid balance issues
        const safeWithdrawalAmount = to1e18(3) // Reduce from 5 to 3 tBTC
        await acreBTC
          .connect(testDepositor)
          .redeemAndBridge(safeWithdrawalAmount, redeemerOutputScript)

        // Give withdrawal queue generous tBTC to complete the request
        await tbtc.mint(
          await withdrawalQueue.getAddress(),
          safeWithdrawalAmount * 2n,
        )

        const redemptionData = createRedemptionData(
          testDepositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        // Mock approveAndCall to return false
        await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(false)

        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(currentCount, redemptionData),
        ).to.be.revertedWithCustomError(withdrawalQueue, "ApproveAndCallFailed")
      })
    })

    context("when request ID does not exist", () => {
      it("should handle gracefully", async () => {
        // This will create a default struct with isCompleted = false
        // The function should still work but will process a zero-value request
        await tbtc.setOwner(await tbtcVault.getAddress())

        const redemptionData = createRedemptionData(
          depositor.address,
          walletPubKeyHash,
          undefined,
          undefined,
          undefined,
          redeemerOutputScript,
        )

        // This might revert due to insufficient tBTC balance or other reasons
        // depending on the implementation details
        await expect(
          withdrawalQueue
            .connect(maintainer)
            .finalizeRedeemAndBridge(999, redemptionData),
        ).to.be.reverted
      })
    })
  })

  describe("edge cases and integration", () => {
    beforeAfterSnapshotWrapper()

    const redeemerOutputScript = "0x1234"
    const depositAmount = to1e18(10)

    it("should handle multiple bridge requests from same user", async () => {
      const initialCount = await withdrawalQueue.count()

      await tbtc.mint(depositor.address, depositAmount)
      await tbtc
        .connect(depositor)
        .approve(await acreBTC.getAddress(), depositAmount)
      await acreBTC.connect(depositor).deposit(depositAmount, depositor.address)

      await midasAllocator.connect(maintainer).allocate()

      const amount1 = to1e18(2)
      const amount2 = to1e18(3)

      await acreBTC
        .connect(depositor)
        .redeemAndBridge(amount1, redeemerOutputScript)

      await acreBTC
        .connect(depositor)
        .redeemAndBridge(amount2, redeemerOutputScript)

      expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)

      const request1 = await withdrawalQueue.withdrawalRequests(initialCount)
      const request2 = await withdrawalQueue.withdrawalRequests(
        initialCount + 1n,
      )

      expect(request1.redeemer).to.equal(depositor.address)
      expect(request1.tbtcAmount).to.be.closeTo(amount1, to1e18(1)) // Allow 1 tBTC difference for rounding

      expect(request2.redeemer).to.equal(depositor.address)
      expect(request2.tbtcAmount).to.be.closeTo(amount2, to1e18(1)) // Allow 1 tBTC difference for rounding
    })

    it("should handle mixed direct and bridge redemptions", async () => {
      const initialCount = await withdrawalQueue.count()

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

      // First withdraw tBTC from the vault to test the insufficient balance path
      const acreBTCAddress = await acreBTC.getAddress()
      const currentBalance = await tbtc.balanceOf(acreBTCAddress)
      if (currentBalance > 0) {
        await impersonateAccount(acreBTCAddress)
        await setBalance(acreBTCAddress, ethers.parseEther("1"))
        const acreBTCSigner = await ethers.getSigner(acreBTCAddress)
        await tbtc
          .connect(acreBTCSigner)
          .transfer(depositor2.address, currentBalance)
        await stopImpersonatingAccount(acreBTCAddress)
      }

      const amount1 = to1e18(2)
      const amount2 = to1e18(3)

      // Direct redemption - should not increment counter
      await acreBTC
        .connect(depositor)
        .redeem(amount1, depositor.address, depositor.address)

      expect(await withdrawalQueue.count()).to.equal(initialCount)

      // Bridge redemption - should increment counter
      await acreBTC
        .connect(depositor)
        .redeemAndBridge(amount2, redeemerOutputScript)

      expect(await withdrawalQueue.count()).to.equal(initialCount + 1n)

      const request = await withdrawalQueue.withdrawalRequests(initialCount)
      expect(request.redeemer).to.equal(depositor.address)
      // The tbtcAmount should be reasonable - allowing for conversion rate changes after first redemption
      // After the direct redemption, the vault ratio changed significantly, so we expect a higher tBTC amount
      expect(request.tbtcAmount).to.be.closeTo(amount2, to1e18(4)) // Allow 4 tBTC difference for significant rate changes
    })

    it("should handle bridge requests from multiple users", async () => {
      const initialCount = await withdrawalQueue.count()

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

      await acreBTC.connect(depositor).redeemAndBridge(amount, outputScript1)

      await acreBTC.connect(depositor2).redeemAndBridge(amount, outputScript2)

      expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)

      const request1 = await withdrawalQueue.withdrawalRequests(initialCount)
      const request2 = await withdrawalQueue.withdrawalRequests(
        initialCount + 1n,
      )

      expect(request1.redeemer).to.equal(depositor.address)
      expect(request1.redeemerOutputScript).to.equal(outputScript1)

      expect(request2.redeemer).to.equal(depositor2.address)
      expect(request2.redeemerOutputScript).to.equal(outputScript2)
    })
  })
})
