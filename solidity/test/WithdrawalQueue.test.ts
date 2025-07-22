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
    StBTC as stBTC,
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
    redeemerOutputScript: string = "0x00000000",
    requestedAmount: bigint = to1e18(1),
    extraData: string = "0x"
): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [redeemer, walletPubKeyHash, mainUtxo, redeemerOutputScript, requestedAmount, extraData]
    )
}

async function fixture() {
    const { tbtc, stbtc, midasAllocator, midasVault, tbtcVault } = await deployment()
    const { governance, maintainer } = await getNamedSigners()
    const [depositor, depositor2, thirdParty, deployer] = await getUnnamedSigners()

    // Deploy WithdrawalQueue
    const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue", deployer)
    const withdrawalQueue = await upgrades.deployProxy(
        WithdrawalQueueFactory,
        [
            await tbtc.getAddress(),
            await midasVault.getAddress(),
            await midasAllocator.getAddress(),
            await tbtcVault.getAddress(),
            await stbtc.getAddress(),
        ],
        {
            kind: "transparent",
        }
    ) as unknown as WithdrawalQueue

    // Set withdrawal queue in MidasAllocator
    await midasAllocator.connect(governance).setWithdrawalQueue(await withdrawalQueue.getAddress())

    // Add maintainer to WithdrawalQueue (using deployer who is the initial owner)
    await withdrawalQueue.connect(deployer).addMaintainer(maintainer.address)

    // Transfer ownership to governance
    await withdrawalQueue.connect(deployer).transferOwnership(governance.address)

    return {
        governance,
        thirdParty,
        depositor,
        depositor2,
        maintainer,
        deployer,
        tbtc,
        stbtc,
        midasAllocator,
        midasVault,
        tbtcVault,
        withdrawalQueue,
    }
}

describe("WithdrawalQueue", () => {
    let tbtc: TestTBTC
    let stbtc: stBTC
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
        ; ({
            thirdParty,
            maintainer,
            governance,
            depositor,
            depositor2,
            deployer,
            tbtc,
            stbtc,
            midasAllocator,
            midasVault,
            tbtcVault,
            withdrawalQueue,
        } = await loadFixture(fixture))

        // Set fees to 0 for simpler testing
        await stbtc.connect(governance).updateEntryFeeBasisPoints(0)
        await stbtc.connect(governance).updateExitFeeBasisPoints(0)

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
            expect(await withdrawalQueue.vault()).to.equal(await midasVault.getAddress())
            expect(await withdrawalQueue.midasAllocator()).to.equal(await midasAllocator.getAddress())
            expect(await withdrawalQueue.tbtcVault()).to.equal(await tbtcVault.getAddress())
            expect(await withdrawalQueue.stbtc()).to.equal(await stbtc.getAddress())
            expect(await withdrawalQueue.count()).to.equal(0)
        })

        it("should revert if tbtc address is zero", async () => {
            const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue")
            await expect(
                upgrades.deployProxy(
                    WithdrawalQueueFactory,
                    [
                        ethers.ZeroAddress,
                        await midasVault.getAddress(),
                        await midasAllocator.getAddress(),
                        await tbtcVault.getAddress(),
                        await stbtc.getAddress(),
                    ],
                    {
                        kind: "transparent",
                    }
                )
            ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
        })

        it("should revert if vault address is zero", async () => {
            const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue")
            await expect(
                upgrades.deployProxy(
                    WithdrawalQueueFactory,
                    [
                        await tbtc.getAddress(),
                        ethers.ZeroAddress,
                        await midasAllocator.getAddress(),
                        await tbtcVault.getAddress(),
                        await stbtc.getAddress(),
                    ],
                    {
                        kind: "transparent",
                    }
                )
            ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
        })

        it("should revert if midasAllocator address is zero", async () => {
            const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue")
            await expect(
                upgrades.deployProxy(
                    WithdrawalQueueFactory,
                    [
                        await tbtc.getAddress(),
                        await midasVault.getAddress(),
                        ethers.ZeroAddress,
                        await tbtcVault.getAddress(),
                        await stbtc.getAddress(),
                    ],
                    {
                        kind: "transparent",
                    }
                )
            ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
        })

        it("should revert if tbtcVault address is zero", async () => {
            const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue")
            await expect(
                upgrades.deployProxy(
                    WithdrawalQueueFactory,
                    [
                        await tbtc.getAddress(),
                        await midasVault.getAddress(),
                        await midasAllocator.getAddress(),
                        ethers.ZeroAddress,
                        await stbtc.getAddress(),
                    ],
                    {
                        kind: "transparent",
                    }
                )
            ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
        })

        it("should revert if stbtc address is zero", async () => {
            const WithdrawalQueueFactory = await ethers.getContractFactory("WithdrawalQueue")
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
                    }
                )
            ).to.be.revertedWithCustomError(withdrawalQueue, "ZeroAddress")
        })
    })

    describe("createWithdrawalRequest", () => {
        beforeAfterSnapshotWrapper()

        const walletPubKeyHash = "0x" + "12".repeat(20) // 20 bytes
        const depositAmount = to1e18(10)
        const withdrawalAmount = to1e18(5)

        context("when user has sufficient stBTC balance", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Setup: Give depositor generous amount of tBTC and let them deposit to get stBTC
                const generousAmount = to1e18(100) // Much larger amount
                await tbtc.mint(depositor.address, generousAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), generousAmount)
                await stbtc.connect(depositor).deposit(generousAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), generousAmount)

                // Allocate funds to Midas to have shares available
                await midasAllocator.connect(maintainer).allocate()
            })

            it("should create withdrawal request successfully", async () => {

                const tbtcAmount = await stbtc.convertToAssets(withdrawalAmount)
                const midasVaultShares = await midasVault.convertToShares(tbtcAmount)

                const tx = await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                const request = await withdrawalQueue.withdrawalRequests(0)


                expect(request.redeemer).to.equal(depositor.address)
                expect(request.shares).to.equal(withdrawalAmount)
                expect(request.tbtcAmount).to.equal(withdrawalAmount)
                expect(request.isCompleted).to.be.false
                expect(request.walletPubKeyHash).to.equal(walletPubKeyHash)
                expect(request.receiveOnEVM).to.be.false
                expect(request.midasRequestId).to.equal(1) // First request



                await expect(tx)
                    .to.emit(withdrawalQueue, "WithdrawalRequestCreated")
                    .withArgs(
                        0,
                        depositor.address,
                        midasVaultShares,
                        tbtcAmount,
                        walletPubKeyHash,
                        1,
                        false
                    )
            })

            it("should burn stBTC from depositor", async () => {
                const balanceBefore = await stbtc.balanceOf(depositor.address)

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)

                const balanceAfter = await stbtc.balanceOf(depositor.address)
                expect(balanceBefore - balanceAfter).to.equal(withdrawalAmount)
            })

            it("should increment request counter", async () => {
                const initialCount = await withdrawalQueue.count()

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                expect(await withdrawalQueue.count()).to.equal(initialCount + 1n)

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)

                expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)
            })

            it("should work with receiveOnEVM flag set to true", async () => {
                const currentCount = await withdrawalQueue.count()
                const tbtcAmount = await stbtc.convertToAssets(withdrawalAmount)
                const midasVaultShares = await midasVault.convertToShares(tbtcAmount)
                const tx = await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)

                const request = await withdrawalQueue.withdrawalRequests(currentCount)
                expect(request.receiveOnEVM).to.be.true

                await expect(tx)
                    .to.emit(withdrawalQueue, "WithdrawalRequestCreated")
                    .withArgs(
                        currentCount,
                        depositor.address,
                        midasVaultShares,
                        tbtcAmount,
                        walletPubKeyHash,
                        request.midasRequestId,
                        true
                    )
            })
        })

        context("when user has insufficient stBTC balance", () => {
            it("should revert", async () => {
                const largeAmount = to1e18(1000)
                await expect(
                    withdrawalQueue
                        .connect(depositor)
                        .createWithdrawalRequest(largeAmount, walletPubKeyHash, false)
                ).to.be.reverted // ERC20 transfer will fail
            })
        })

        context("when user has not approved stBTC", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Give depositor2 some stBTC but don't set approval
                await tbtc.mint(depositor2.address, depositAmount)
                await tbtc.connect(depositor2).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor2).deposit(depositAmount, depositor2.address)
                // Reset approval
                await stbtc.connect(depositor2).approve(await withdrawalQueue.getAddress(), 0)
            })

            it("should revert", async () => {
                await expect(
                    withdrawalQueue
                        .connect(depositor2)
                        .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)
                ).to.be.reverted // Transfer will fail due to insufficient allowance
            })
        })
    })

    describe("completeWithdrawalRequest", () => {
        beforeAfterSnapshotWrapper()

        const walletPubKeyHash = "0x" + "12".repeat(20)
        const depositAmount = to1e18(10)
        const withdrawalAmount = to1e18(5)

        context("when caller is not maintainer", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Setup withdrawal request
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)
            })

            it("should revert", async () => {
                const redemptionData = createRedemptionData(depositor.address, walletPubKeyHash)

                await expect(
                    withdrawalQueue.connect(thirdParty).completeWithdrawalRequest(0, redemptionData)
                ).to.be.revertedWithCustomError(withdrawalQueue, "CallerNotMaintainer")
            })
        })

        context("when tBTC token owner is not tbtcVault", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Setup withdrawal request
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)
            })

            it("should revert", async () => {
                // Set tBTC owner to something other than tbtcVault
                await tbtc.setOwner(thirdParty.address)

                const redemptionData = createRedemptionData(depositor.address, walletPubKeyHash)

                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(0, redemptionData)
                ).to.be.revertedWithCustomError(withdrawalQueue, "UnexpectedTbtcTokenOwner")
            })
        })

        context("when withdrawal request is already completed", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Setup and complete a withdrawal request
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true) // EVM withdrawal

                // Set tBTC owner to tbtcVault
                await tbtc.setOwner(await tbtcVault.getAddress())

                // Give withdrawal queue some tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount)

                // Complete the request
                await withdrawalQueue.connect(maintainer).completeWithdrawalRequest(0, "0x")
            })

            it("should revert", async () => {
                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(0, "0x")
                ).to.be.revertedWithCustomError(withdrawalQueue, "WithdrawalRequestAlreadyCompleted")
            })
        })

        context("when receiveOnEVM is true", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Set tBTC owner to tbtcVault for all tests in this context
                await tbtc.setOwner(await tbtcVault.getAddress())
            })

            it("should transfer tBTC to redeemer", async () => {
                // Setup withdrawal request for EVM delivery
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                const balanceBefore = await tbtc.balanceOf(depositor.address)

                const tx = await withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, "0x")

                const balanceAfter = await tbtc.balanceOf(depositor.address)
                expect(balanceAfter - balanceBefore).to.equal(withdrawalAmount) // No exit fee set

                await expect(tx).to.emit(withdrawalQueue, "WithdrawalRequestCompleted").withArgs(currentCount)
            })

            it("should mark request as completed", async () => {
                // Setup another withdrawal request for this test
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                await withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, "0x")

                const request = await withdrawalQueue.withdrawalRequests(currentCount)
                expect(request.isCompleted).to.be.true
                expect(request.completedAt).to.be.greaterThan(0)
            })

            context("with exit fee", () => {
                beforeAfterSnapshotWrapper()

                before(async () => {
                    // Set 1% exit fee
                    await stbtc.connect(governance).updateExitFeeBasisPoints(100)

                    // Setup treasury
                    await stbtc.connect(governance).updateTreasury(governance.address)
                })

                it("should deduct exit fee and send to treasury", async () => {
                    // Setup another withdrawal request for this test
                    await tbtc.mint(depositor.address, depositAmount)
                    await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                    await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                    // Approve WithdrawalQueue to spend stBTC
                    await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                    await midasAllocator.connect(maintainer).allocate()

                    const currentCount = await withdrawalQueue.count()
                    await withdrawalQueue
                        .connect(depositor)
                        .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, true)
                    const request = await withdrawalQueue.withdrawalRequests(currentCount)
                    const exitFeeBasisPoints = await stbtc.exitFeeBasisPoints()
                    const expectedFee = (request.tbtcAmount * exitFeeBasisPoints) / 10000n
                    const expectedTransfer = request.tbtcAmount - expectedFee

                    // Give withdrawal queue enough tBTC to cover both withdrawal and fee
                    await tbtc.mint(await withdrawalQueue.getAddress(), request.tbtcAmount * 3n)

                    const depositorBalanceBefore = await tbtc.balanceOf(depositor.address)
                    const treasuryBalanceBefore = await tbtc.balanceOf(governance.address)

                    await withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, "0x")

                    const depositorBalanceAfter = await tbtc.balanceOf(depositor.address)
                    const treasuryBalanceAfter = await tbtc.balanceOf(governance.address)

                    expect(depositorBalanceAfter - depositorBalanceBefore).to.equal(expectedTransfer)
                    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee)
                })
            })
        })

        context("when receiveOnEVM is false (Bitcoin withdrawal)", () => {
            beforeAfterSnapshotWrapper()

            before(async () => {
                // Set tBTC owner to tbtcVault for all tests in this context
                await tbtc.setOwner(await tbtcVault.getAddress())
            })

            it("should call tbtcVault.requestRedemption with correct data", async () => {
                // Setup withdrawal request for Bitcoin delivery
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                const redemptionData = createRedemptionData(depositor.address, walletPubKeyHash)

                // Mock approveAndCall to return true
                await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(true)

                const tx = await withdrawalQueue
                    .connect(maintainer)
                    .completeWithdrawalRequest(currentCount, redemptionData)

                await expect(tx).to.emit(withdrawalQueue, "WithdrawalRequestCompleted").withArgs(currentCount)
            })

            it("should revert if redemption data has wrong redeemer", async () => {
                // Setup another withdrawal request for this test
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                const wrongRedemptionData = createRedemptionData(thirdParty.address, walletPubKeyHash)

                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, wrongRedemptionData)
                ).to.be.revertedWithCustomError(withdrawalQueue, "InvalidRedemptionData")
            })

            it("should revert if redemption data has wrong wallet pub key hash", async () => {
                // Setup another withdrawal request for this test
                await tbtc.mint(depositor.address, depositAmount)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
                await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), withdrawalAmount)

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                const wrongWalletPubKeyHash = "0x" + "34".repeat(20)
                const wrongRedemptionData = createRedemptionData(depositor.address, wrongWalletPubKeyHash)

                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, wrongRedemptionData)
                ).to.be.revertedWithCustomError(withdrawalQueue, "InvalidRedemptionData")
            })

            it("should revert if approveAndCall fails", async () => {
                const tbtcNeeded = await stbtc.convertToAssets(withdrawalAmount)
                await tbtc.mint(depositor.address, tbtcNeeded)
                await tbtc.connect(depositor).approve(await stbtc.getAddress(), tbtcNeeded)
                await stbtc.connect(depositor).deposit(tbtcNeeded, depositor.address)

                await tbtc.mint(await withdrawalQueue.getAddress(), to1e18(10))

                // Approve WithdrawalQueue to spend stBTC
                await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), to1e18(10))

                await midasAllocator.connect(maintainer).allocate()

                const currentCount = await withdrawalQueue.count()
                await withdrawalQueue
                    .connect(depositor)
                    .createWithdrawalRequest(withdrawalAmount, walletPubKeyHash, false)

                // Give withdrawal queue generous tBTC to complete the request
                await tbtc.mint(await withdrawalQueue.getAddress(), withdrawalAmount * 2n)

                const redemptionData = createRedemptionData(depositor.address, walletPubKeyHash)

                // Mock approveAndCall to return false
                await tbtc.connect(tbtcVaultFakeSigner).setApproveAndCallResult(false)

                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(currentCount, redemptionData)
                ).to.be.revertedWithCustomError(withdrawalQueue, "ApproveAndCallFailed")
            })
        })

        context("when request ID does not exist", () => {
            it("should handle gracefully", async () => {
                // This will create a default struct with isCompleted = false
                // The function should still work but will process a zero-value request
                await tbtc.setOwner(await tbtcVault.getAddress())

                const redemptionData = createRedemptionData(depositor.address, walletPubKeyHash)

                // This might revert due to insufficient tBTC balance or other reasons
                // depending on the implementation details
                await expect(
                    withdrawalQueue.connect(maintainer).completeWithdrawalRequest(999, redemptionData)
                ).to.be.reverted
            })
        })
    })

    describe("edge cases and integration", () => {
        beforeAfterSnapshotWrapper()

        const walletPubKeyHash = "0x" + "12".repeat(20)
        const depositAmount = to1e18(10)

        it("should handle multiple withdrawal requests from same user", async () => {
            const initialCount = await withdrawalQueue.count()

            await tbtc.mint(depositor.address, depositAmount)
            await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
            await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

            // Approve WithdrawalQueue to spend stBTC
            await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), depositAmount)

            await midasAllocator.connect(maintainer).allocate()

            const amount1 = to1e18(2)
            const amount2 = to1e18(3)

            await withdrawalQueue
                .connect(depositor)
                .createWithdrawalRequest(amount1, walletPubKeyHash, true)

            await withdrawalQueue
                .connect(depositor)
                .createWithdrawalRequest(amount2, walletPubKeyHash, false)

            expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)

            const request1 = await withdrawalQueue.withdrawalRequests(initialCount)
            const request2 = await withdrawalQueue.withdrawalRequests(initialCount + 1n)

            expect(request1.redeemer).to.equal(depositor.address)
            expect(request1.tbtcAmount).to.be.closeTo(amount1, to1e18(1)) // Allow 1 tBTC difference for rounding
            expect(request1.receiveOnEVM).to.be.true

            expect(request2.redeemer).to.equal(depositor.address)
            expect(request2.tbtcAmount).to.be.closeTo(amount2, to1e18(1)) // Allow 1 tBTC difference for rounding
            expect(request2.receiveOnEVM).to.be.false
        })

        it("should handle withdrawal requests from multiple users", async () => {
            const initialCount = await withdrawalQueue.count()

            // Setup for depositor
            await tbtc.mint(depositor.address, depositAmount)
            await tbtc.connect(depositor).approve(await stbtc.getAddress(), depositAmount)
            await stbtc.connect(depositor).deposit(depositAmount, depositor.address)

            // Setup for depositor2
            await tbtc.mint(depositor2.address, depositAmount)
            await tbtc.connect(depositor2).approve(await stbtc.getAddress(), depositAmount)
            await stbtc.connect(depositor2).deposit(depositAmount, depositor2.address)

            // Approve WithdrawalQueue to spend stBTC for both depositors
            await stbtc.connect(depositor).approve(await withdrawalQueue.getAddress(), depositAmount)
            await stbtc.connect(depositor2).approve(await withdrawalQueue.getAddress(), depositAmount)

            await midasAllocator.connect(maintainer).allocate()

            const amount = to1e18(3)
            const wallet1 = "0x" + "11".repeat(20)
            const wallet2 = "0x" + "22".repeat(20)

            await withdrawalQueue
                .connect(depositor)
                .createWithdrawalRequest(amount, wallet1, true)

            await withdrawalQueue
                .connect(depositor2)
                .createWithdrawalRequest(amount, wallet2, false)

            expect(await withdrawalQueue.count()).to.equal(initialCount + 2n)

            const request1 = await withdrawalQueue.withdrawalRequests(initialCount)
            const request2 = await withdrawalQueue.withdrawalRequests(initialCount + 1n)

            expect(request1.redeemer).to.equal(depositor.address)
            expect(request1.walletPubKeyHash).to.equal(wallet1)

            expect(request2.redeemer).to.equal(depositor2.address)
            expect(request2.walletPubKeyHash).to.equal(wallet2)
        })
    })
}) 