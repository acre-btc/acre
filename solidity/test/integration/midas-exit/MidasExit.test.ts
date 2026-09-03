import { expect } from "chai"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { ethers, upgrades } from "hardhat"
import type { Signer } from "ethers"

import {
  beforeAfterEachSnapshotWrapper,
  beforeAfterSnapshotWrapper,
} from "../../helpers"

import type {
  AcreBTC,
  BitcoinRedeemerV2,
  BitcoinRedeemerV3,
  IERC20,
  MidasAllocator,
  WithdrawalQueue,
  IBridge,
} from "../../../typechain"
import type {
  MidasAccessControl,
  MidasRedemptionVault,
  MidasVault,
} from "../../../typechain/external"
import { redemptionFixture } from "./data/redemption"

import {
  ACRE,
  REQUEST_PENDING,
  REQUEST_PROCESSED,
  APPROVE_REQUEST_SELECTOR,
  EXTERNAL,
  FORK_BLOCK,
  MIDAS,
  REDEEM_REQUEST_CUSTOM_RECIPIENT_SELECTOR,
  ROLES,
  ROLE_REDEMPTION_VAULT_ADMIN,
  TEST_HOLDER,
  atDeployment,
  atExternal,
  forkingConfigured,
  impersonate,
  resetToMainnetFork,
  settleMidasRequest,
} from "./helpers"

/**
 * Mainnet fork test for the Midas exit.
 *
 * Acre keeps all user tBTC in an external Midas vault. To wind that down, a set
 * of owner transactions has to run on mainnet in a fixed order. This test runs
 * those same transactions on a fork of mainnet, so we can check the order works
 * before doing it for real.
 *
 * The describe blocks are the steps, and they run in this order:
 *
 *   step 1  read the current state and check our assumptions
 *   step 2  MidasAllocator.removeMaintainer, so the bot cannot move funds
 *   step 3  acreBTC.updateWithdrawalQueue(0), to block the slow withdrawals
 *   step 4  acreBTC.pause(), to block deposits and redeems
 *   step 5  MidasAllocator.emergencyWithdraw(), to get all the tBTC back
 *   step 6  block deposits for good, then unpause so users can withdraw
 *   step 7  deploy BitcoinRedeemerV3, so users can also take native BTC
 *
 * Steps 3 and 4 must both happen before step 5. Step 3 is the important one,
 * because pause() does not block requestRedeem. There is a test in step 4 that
 * shows this.
 *
 * The blocks are one sequence, not separate tests. Each one starts from the
 * state left by the one before it, like the real operation does. Tests that
 * must not change that state sit in their own describe block with a snapshot.
 *
 * Nothing here is mocked. Every contract is the real one on mainnet. Every
 * owner call is made by impersonating the real owner. The Midas payout uses
 * Midas's own approveRequest. The only thing we stand in for is a person at
 * Midas deciding to approve.
 *
 * Run with:  MAINNET_RPC_URL=<rpc url> pnpm test:midas-exit
 */
describe("Midas exit - mainnet fork rehearsal", () => {
  let governance: Signer
  let maintainer: Signer
  let pauseAdmin: Signer
  let holder: Signer
  let receiver: Signer

  let acreBtc: AcreBTC
  let midasAllocator: MidasAllocator
  let withdrawalQueue: WithdrawalQueue
  let bitcoinRedeemerV2: BitcoinRedeemerV2
  let tbtc: IERC20
  let mToken: IERC20
  let adapter: MidasVault
  let redemptionVault: MidasRedemptionVault

  /** `acreBTC.totalAssets()` before anything is touched - the exit baseline. */
  let baselineTotalAssets: bigint
  let baselineTotalSupply: bigint
  let holderShares: bigint

  /**
   * Step 6 redeems two small parts of the holder's position. Step 7 then needs
   * what is left to be above the tBTC Bridge minimum (0.009 tBTC, and the
   * holder has about 0.021 tBTC). We use basis points instead of plain
   * divisions so the sizes are easy to read. Step 7 also checks the rest is
   * still big enough, so we do not rely on this maths staying right.
   */
  const FIRST_SLICE_BPS = 1_000n // 10%
  const SECOND_SLICE_BPS = 500n // 5%
  const BPS_DENOMINATOR = 10_000n

  const sliceOfPosition = (bps: bigint): bigint =>
    (holderShares * bps) / BPS_DENOMINATOR

  before(async function () {
    if (!forkingConfigured()) {
      // eslint-disable-next-line no-console
      console.warn(
        "\n  SKIPPED: set MAINNET_RPC_URL to an archive endpoint to run the " +
          "Midas exit fork rehearsal.\n",
      )
      this.skip()
    }

    await resetToMainnetFork()

    governance = await impersonate(ROLES.governance)
    maintainer = await impersonate(ROLES.maintainer)
    pauseAdmin = await impersonate(ROLES.pauseAdmin)
    holder = await impersonate(TEST_HOLDER)
    ;[receiver] = await ethers.getSigners()

    acreBtc = await atDeployment<AcreBTC>("acreBTC")
    midasAllocator = await atDeployment<MidasAllocator>("MidasAllocator")
    withdrawalQueue = await atDeployment<WithdrawalQueue>("WithdrawalQueue")
    bitcoinRedeemerV2 =
      await atDeployment<BitcoinRedeemerV2>("BitcoinRedeemerV2")

    tbtc = await atExternal<IERC20>("TBTC")
    mToken = await atExternal<IERC20>("MidasShareToken")
    adapter = await atExternal<MidasVault>("MidasVault")
    redemptionVault = await atExternal<MidasRedemptionVault>(
      "MidasRedemptionVault",
    )

    baselineTotalAssets = await acreBtc.totalAssets()
    baselineTotalSupply = await acreBtc.totalSupply()
    holderShares = await acreBtc.balanceOf(TEST_HOLDER)

    expect(
      holderShares,
      `TEST_HOLDER ${TEST_HOLDER} holds no acreBTC at block ${FORK_BLOCK}. ` +
        "Pick another holder from acreBTC Transfer logs and update TEST_HOLDER.",
    ).to.be.greaterThan(0n)
  })

  describe("step 1 - pre-flight", () => {
    it("has the owners we expect", async () => {
      const owned: {
        owner(): Promise<string>
        pendingOwner(): Promise<string>
      }[] = [acreBtc, midasAllocator, withdrawalQueue, bitcoinRedeemerV2]

      await Promise.all(
        owned.map(async (c) => {
          expect(await c.owner()).to.equal(ROLES.governance)
          expect(await c.pendingOwner()).to.equal(ethers.ZeroAddress)
        }),
      )
    })

    it("is unpaused, fee-free, and has withdrawals uncapped", async () => {
      expect(await acreBtc.paused()).to.equal(false)
      expect(await acreBtc.nonFungibleWithdrawalsEnabled()).to.equal(false)
      expect(await acreBtc.exitFeeBasisPoints()).to.equal(0n)
    })

    it("still routes through the Midas allocator and the withdrawal queue", async () => {
      expect(await acreBtc.dispatcher()).to.equal(ACRE.midasAllocator)
      expect(await acreBtc.withdrawalQueue()).to.equal(ACRE.withdrawalQueue)
    })

    it("holds all assets in Midas, none idle", async () => {
      // We compare values with each other, never with a fixed number. The
      // mToken rate changes, so any number written down here goes out of date
      // in a few days.
      expect(await tbtc.balanceOf(ACRE.acreBTC)).to.equal(0n)
      expect(await tbtc.balanceOf(ACRE.midasAllocator)).to.equal(0n)
      expect(await midasAllocator.totalAssets()).to.equal(baselineTotalAssets)
    })

    it("reports the state this run is rehearsing against", async () => {
      const allocatorShares = await mToken.balanceOf(ACRE.midasAllocator)
      const redeemerBalance = await tbtc.balanceOf(MIDAS.requestRedeemer)
      const expectedPayout = await adapter.convertToAssets(allocatorShares)

      /* eslint-disable no-console */
      console.log(`      fork block            ${FORK_BLOCK}`)
      console.log(`      acreBTC.totalAssets   ${baselineTotalAssets}`)
      console.log(`      acreBTC.totalSupply   ${baselineTotalSupply}`)
      console.log(`      allocator mTBTC       ${allocatorShares}`)
      console.log(`      expected payout       ${expectedPayout}`)
      console.log(`      requestRedeemer tBTC  ${redeemerBalance}`)
      console.log(
        `      WithdrawalQueue.count ${await withdrawalQueue.count()}`,
      )
      /* eslint-enable no-console */

      // Midas works out the payout again when it pays, using the rate at that
      // moment. So a small buffer here is a real risk on mainnet, not only
      // in this test.
      expect(
        redeemerBalance,
        "Midas requestRedeemer cannot cover the exit - ask Midas to top it up",
      ).to.be.greaterThanOrEqual(expectedPayout)

      const bufferBps =
        ((redeemerBalance - expectedPayout) * 10_000n) / expectedPayout
      // eslint-disable-next-line no-console
      console.log(`      payout buffer         ${bufferBps} bps`)
    })

    it("has every Midas gate open", async () => {
      expect(await redemptionVault.paused()).to.equal(false)
      expect(await redemptionVault.greenlistEnabled()).to.equal(false)
      expect(
        await redemptionVault.fnPaused(
          REDEEM_REQUEST_CUSTOM_RECIPIENT_SELECTOR,
        ),
      ).to.equal(false)
      expect(await redemptionVault.fnPaused(APPROVE_REQUEST_SELECTOR)).to.equal(
        false,
      )
      expect(
        await redemptionVault.waivedFeeRestriction(MIDAS.adapter),
        "AcreAdapter.requestRedeem reverts 'not fee waived' without this",
      ).to.equal(true)
    })

    it("still guards settlement with the role we plan to impersonate", async () => {
      expect(await redemptionVault.vaultRole()).to.equal(
        ROLE_REDEMPTION_VAULT_ADMIN,
      )
      expect(await redemptionVault.accessControl()).to.equal(
        MIDAS.accessControl,
      )
      const accessControl =
        await atExternal<MidasAccessControl>("MidasAccessControl")
      expect(
        await accessControl.hasRole(
          ROLE_REDEMPTION_VAULT_ADMIN,
          MIDAS.vaultAdmin,
        ),
      ).to.equal(true)
    })

    it("wires MidasAllocator to the adapter we researched", async () => {
      expect(await midasAllocator.midasVault()).to.equal(MIDAS.adapter)
      expect(await midasAllocator.acreVault()).to.equal(ACRE.acreBTC)
      expect(await adapter.redemptionVault()).to.equal(MIDAS.redemptionVault)
      expect(await adapter.share()).to.equal(MIDAS.mToken)
      expect(await adapter.asset()).to.equal(EXTERNAL.tbtc)
    })

    // Positive control. Without this, step 3's revert assertion proves nothing:
    // a call that was already broken would also "revert".
    // In its own describe block so the snapshot wrapper undoes it afterwards.
    // The outer steps run in order and must keep their state.
    describe("while the queue is still set", () => {
      beforeAfterSnapshotWrapper()

      it("lets the holder requestRedeemAndBridge", async () => {
        // Length-prefixed P2WPKH, and the whole position: requestRedeemAndBridge
        // enforces the Bridge dust threshold (0.009 tBTC), which a fraction of
        // this holder's ~0.021 tBTC would fall under.
        const script = redemptionFixture.redeemerOutputScript
        await expect(
          acreBtc
            .connect(holder)
            .requestRedeemAndBridge(holderShares, TEST_HOLDER, script),
        ).to.emit(withdrawalQueue, "RedeemAndBridgeRequested")
      })
    })
  })

  describe("step 2 - MidasAllocator.removeMaintainer", () => {
    it("removes every allocator maintainer", async () => {
      const maintainers: string[] = await midasAllocator.getMaintainers()
      expect(maintainers.length).to.be.greaterThan(0)
      // Sequential on purpose: these share a nonce.
      // eslint-disable-next-line no-restricted-syntax
      for (const m of maintainers) {
        // eslint-disable-next-line no-await-in-loop
        await midasAllocator.connect(governance).removeMaintainer(m)
      }
      expect(await midasAllocator.getMaintainers()).to.have.length(0)
    })

    it("stops allocate() - the cron can no longer sweep recovered funds", async () => {
      await expect(
        midasAllocator.connect(maintainer).allocate(),
      ).to.be.revertedWithCustomError(midasAllocator, "CallerNotMaintainer")
    })

    it("leaves the WithdrawalQueue maintainer intact", async () => {
      // Removing this one too would permanently lock the tBTC already sitting in
      // the queue - it has no sweep or rescue function.
      expect(await withdrawalQueue.isMaintainer(ROLES.maintainer)).to.equal(
        true,
      )
      expect(await tbtc.balanceOf(ACRE.withdrawalQueue)).to.be.greaterThan(0n)
    })

    it("leaves the dispatcher's unbounded tBTC allowance in place", async () => {
      // So removing the maintainer is the only thing that stops idle tBTC on
      // acreBTC going back into Midas. The next block shows this.
      expect(
        await tbtc.allowance(ACRE.acreBTC, ACRE.midasAllocator),
      ).to.be.greaterThan(0n)
    })

    // We use a snapshot here. The only account with a lot of tBTC on the fork
    // is Midas's requestRedeemer, and its balance is what pays the exit in
    // step 5. If we took tBTC from it for good, the payout buffer would shrink.
    describe("with idle tBTC donated to acreBTC", () => {
      beforeAfterSnapshotWrapper()

      it("still cannot be swept into Midas", async () => {
        const whale = await impersonate(MIDAS.requestRedeemer)
        const donation = ethers.parseUnits("0.01", 18)

        await expect(
          tbtc.connect(whale).transfer(ACRE.acreBTC, donation),
        ).to.changeTokenBalances(
          tbtc,
          [MIDAS.requestRedeemer, ACRE.acreBTC],
          [-donation, donation],
        )

        await expect(
          midasAllocator.connect(maintainer).allocate(),
        ).to.be.revertedWithCustomError(midasAllocator, "CallerNotMaintainer")
        expect(await tbtc.balanceOf(ACRE.acreBTC)).to.equal(donation)
      })
    })
  })

  describe("step 3 - acreBTC.updateWithdrawalQueue(0)", () => {
    before(async () => {
      await acreBtc
        .connect(governance)
        .updateWithdrawalQueue(ethers.ZeroAddress)
    })

    it("zeroes the queue", async () => {
      expect(await acreBtc.withdrawalQueue()).to.equal(ethers.ZeroAddress)
    })

    // The three tests below pass the holder's whole position on purpose. The
    // check fails before anything is moved or burned, so the amount does not
    // matter. Using a fraction would suggest that it does.

    it("blocks requestRedeem", async () => {
      await expect(
        acreBtc
          .connect(holder)
          .requestRedeem(holderShares, TEST_HOLDER, TEST_HOLDER),
      ).to.be.revertedWithCustomError(acreBtc, "WithdrawalQueueNotSet")
    })

    it("blocks requestRedeemAndBridge", async () => {
      const script = redemptionFixture.redeemerOutputScript
      await expect(
        acreBtc
          .connect(holder)
          .requestRedeemAndBridge(holderShares, TEST_HOLDER, script),
      ).to.be.revertedWithCustomError(acreBtc, "WithdrawalQueueNotSet")
    })

    it("blocks the BitcoinRedeemerV2 approveAndCall path", async () => {
      const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          TEST_HOLDER,
          `0x${"00".repeat(20)}`,
          ethers.ZeroHash,
          0,
          0,
          redemptionFixture.redeemerOutputScript,
        ],
      )
      await expect(
        acreBtc
          .connect(holder)
          .approveAndCall(ACRE.bitcoinRedeemerV2, holderShares, extraData),
      ).to.be.revertedWithCustomError(acreBtc, "WithdrawalQueueNotSet")
    })
  })

  describe("step 4 - acreBTC.pause()", () => {
    before(async () => {
      await acreBtc.connect(pauseAdmin).pause()
    })

    it("pauses", async () => {
      expect(await acreBtc.paused()).to.equal(true)
    })

    it("zeroes every ERC4626 limit", async () => {
      expect(await acreBtc.maxDeposit(TEST_HOLDER)).to.equal(0n)
      expect(await acreBtc.maxMint(TEST_HOLDER)).to.equal(0n)
      expect(await acreBtc.maxWithdraw(TEST_HOLDER)).to.equal(0n)
      expect(await acreBtc.maxRedeem(TEST_HOLDER)).to.equal(0n)
    })

    it("blocks deposit and redeem", async () => {
      // Deposit above the minimum, or `LessThanMinDeposit` fires first and we
      // never reach the pause guard we are actually testing. No tBTC is needed:
      // both checks precede the transfer.
      const minimum = await acreBtc.minimumDepositAmount()
      await expect(
        acreBtc.connect(holder).deposit(minimum, TEST_HOLDER),
      ).to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxDeposit")
      await expect(
        acreBtc.connect(holder).redeem(1n, TEST_HOLDER, TEST_HOLDER),
      ).to.be.revertedWithCustomError(acreBtc, "ERC4626ExceededMaxRedeem")
    })

    // What pause() does not stop. Each test changes state, so we restore after
    // every one. The outer steps must carry on from a paused vault with no
    // withdrawal queue.
    describe("gaps the pause does not close", () => {
      beforeAfterEachSnapshotWrapper()

      it("does NOT block requestRedeem - which is why step 3 exists", async () => {
        // This shows the gap. With pause() alone, a user could still burn
        // their whole position for about 0 tBTC during the exit. We use the
        // whole position because that is what a user could have lost. It is
        // safe to spend it here, because the snapshot is restored after.
        await acreBtc
          .connect(governance)
          .updateWithdrawalQueue(ACRE.withdrawalQueue)
        expect(await acreBtc.paused()).to.equal(true)
        await expect(
          acreBtc
            .connect(holder)
            .requestRedeem(holderShares, TEST_HOLDER, TEST_HOLDER),
        ).to.not.be.reverted
      })

      it("does NOT block ERC20 transfers", async () => {
        await expect(
          acreBtc.connect(holder).transfer(await receiver.getAddress(), 1n),
        ).to.not.be.reverted
      })
    })
  })

  describe("step 5 - MidasAllocator.emergencyWithdraw", () => {
    let requestId: bigint
    let allocatorSharesBefore: bigint
    let expectedPayout: bigint

    it("files a Midas redemption request", async () => {
      allocatorSharesBefore = await mToken.balanceOf(ACRE.midasAllocator)
      expect(allocatorSharesBefore).to.be.greaterThan(0n)
      expectedPayout = await adapter.convertToAssets(allocatorSharesBefore)

      // Midas takes the current counter as the id, then adds one. So we can
      // read the id this request will get before we send the transaction, and
      // we do not have to search the logs for it.
      requestId = await redemptionVault.currentRequestId()

      // This is the key point of the whole exit: Midas saves acreBTC as the
      // receiver. We check every argument of the event, not just one, so any
      // change to them fails here.
      await expect(midasAllocator.connect(governance).emergencyWithdraw())
        .to.emit(redemptionVault, "RedeemRequestWithCustomRecipient")
        .withArgs(
          // Request id.
          requestId,
          // Caller, from the vault's point of view: the AcreAdapter.
          MIDAS.adapter,
          // Token out.
          EXTERNAL.tbtc,
          // Recipient - the claim this test exists to prove.
          ACRE.acreBTC,
          // mTBTC redeemed: the allocator's entire position.
          allocatorSharesBefore,
          // Fee: zero, because the adapter is fee-waived.
          0n,
        )
    })

    it("records acreBTC as the payee in Midas storage", async () => {
      // Midas pays `request.sender` when it approves. So this is the proof on
      // chain that the tBTC will go to acreBTC, not to the allocator.
      const request = await redemptionVault.redeemRequests(requestId)
      expect(request.sender).to.equal(ACRE.acreBTC)
      expect(request.tokenOut).to.equal(EXTERNAL.tbtc)
      expect(request.status).to.equal(REQUEST_PENDING)
      expect(request.amountMToken).to.equal(allocatorSharesBefore)
    })

    it("empties the allocator", async () => {
      expect(await mToken.balanceOf(ACRE.midasAllocator)).to.equal(0n)
      expect(await midasAllocator.totalAssets()).to.equal(0n)
    })

    it("collapses totalAssets while leaving every user's shares untouched", async () => {
      // This is the risky moment that the order of these steps protects
      // against. No other test covers it, because the MidasVaultStub used in
      // unit tests pays out straight away.
      // Exactly zero, not just small. acreBTC has no idle tBTC (step 1) and
      // the allocator now has no mTBTC and no tBTC, so both parts of
      // totalAssets() are 0. All user shares still exist.
      expect(await acreBtc.totalAssets()).to.equal(0n)
      expect(await acreBtc.totalSupply()).to.equal(baselineTotalSupply)
      expect(await acreBtc.balanceOf(TEST_HOLDER)).to.equal(holderShares)
    })

    it("lands the tBTC on acreBTC once Midas settles", async () => {
      // We check both sides of the transfer. Midas pays from requestRedeemer
      // and acreBTC receives. Checking the source too proves the money came
      // from where we think.
      await expect(settleMidasRequest(requestId)).to.changeTokenBalances(
        tbtc,
        [ACRE.acreBTC, MIDAS.requestRedeemer],
        [expectedPayout, -expectedPayout],
      )
    })

    it("reconciles against the pre-exit baseline", async () => {
      const recovered = await tbtc.balanceOf(ACRE.acreBTC)

      // Exact, with no margin. The mTBTC rate does not change between blocks
      // on a fork, so the payout is equal to the position we measured before
      // the exit. We must be sure of this before unpausing in step 6.
      expect(recovered).to.equal(baselineTotalAssets)
      expect(await acreBtc.totalAssets()).to.equal(recovered)
      expect(await acreBtc.totalSupply()).to.equal(baselineTotalSupply)
    })

    it("strands nothing on the allocator", async () => {
      // emergencyWithdraw moves only the Midas shares, and there is no way to
      // rescue anything left behind.
      expect(await tbtc.balanceOf(ACRE.midasAllocator)).to.equal(0n)
      expect(await mToken.balanceOf(ACRE.midasAllocator)).to.equal(0n)
    })

    it("marks the Midas request processed", async () => {
      const request = await redemptionVault.redeemRequests(requestId)
      expect(request.status).to.equal(REQUEST_PROCESSED)
    })
  })

  describe("step 6 - block deposits, then unpause", () => {
    before(async () => {
      await acreBtc
        .connect(governance)
        .updateMinimumDepositAmount(ethers.MaxUint256)
      await acreBtc.connect(pauseAdmin).unpause()
    })

    it("unpauses", async () => {
      expect(await acreBtc.paused()).to.equal(false)
    })

    // We redeem only small parts here on purpose. The holder has about
    // 0.021 tBTC in total, and step 7 needs more than the Bridge minimum of
    // 0.009 tBTC. If we used it all here, we could not test the BTC path.
    it("lets a holder redeem to an external EVM address", async () => {
      const receiverAddress = await receiver.getAddress()
      const shares = sliceOfPosition(FIRST_SLICE_BPS)
      const preview = await acreBtc.previewRedeem(shares)

      // Captured rather than inlined: one transaction, two different balance
      // assertions - tBTC out to the receiver, acreBTC burned from the Safe.
      const tx = await acreBtc
        .connect(holder)
        .redeem(shares, receiverAddress, TEST_HOLDER)

      await expect(tx).to.changeTokenBalances(
        tbtc,
        [receiverAddress, ACRE.acreBTC],
        [preview, -preview],
      )
      await expect(tx).to.changeTokenBalances(acreBtc, [TEST_HOLDER], [-shares])
    })

    it("still blocks deposits", async () => {
      // This tBTC comes from the redeem above, so we do not need to take any
      // from Midas's requestRedeemer.
      const receiverAddress = await receiver.getAddress()
      const amount = await tbtc.balanceOf(receiverAddress)
      expect(amount).to.be.greaterThan(0n)

      await tbtc.connect(receiver).approve(ACRE.acreBTC, amount)
      await expect(
        acreBtc.connect(receiver).deposit(amount, receiverAddress),
      ).to.be.revertedWithCustomError(acreBtc, "LessThanMinDeposit")
    })

    it("keeps the share price stable for the next redeemer", async () => {
      const one = ethers.parseUnits("1", 18)
      const rateBefore = await acreBtc.convertToAssets(one)

      const receiverAddress = await receiver.getAddress()
      const shares = sliceOfPosition(SECOND_SLICE_BPS)
      await acreBtc.connect(holder).redeem(shares, receiverAddress, TEST_HOLDER)

      // Exactly the same, not just close. A redeem burns shares and pays out
      // assets in the same proportion, so the price per share must not move at
      // all. If it moved, one holder would be paying for another.
      expect(await acreBtc.convertToAssets(one)).to.equal(rateBefore)
    })

    /**
     * The main user exit: acreBTC to tBTC on Ethereum, sent to an address the
     * user gives us. This is the path we expect most holders to use, and the
     * only one for holders with less than the Bridge minimum.
     *
     * Each test here uses the whole position, and step 7 needs what is left,
     * so we restore a snapshot after every one.
     *
     * The receiver is a normal wallet on purpose. Sending the tBTC to the
     * user's own OrangeKit Safe would lock it there, because the Safe has no
     * ETH and the relayer only allows calls to Acre contracts. That is a
     * problem for the dapp to prevent. acreBTC cannot check it, so we do not
     * test it here.
     */
    describe("exiting fully to tBTC on Ethereum", () => {
      beforeAfterEachSnapshotWrapper()

      it("redeems the entire remaining position", async () => {
        const receiverAddress = await receiver.getAddress()
        const shares = await acreBtc.balanceOf(TEST_HOLDER)
        const assets = await acreBtc.previewRedeem(shares)
        const supplyBefore = await acreBtc.totalSupply()

        expect(
          shares,
          "holder has nothing left to exit with",
        ).to.be.greaterThan(0n)

        const tx = await acreBtc
          .connect(holder)
          .redeem(shares, receiverAddress, TEST_HOLDER)

        await expect(tx).to.changeTokenBalances(
          tbtc,
          [receiverAddress, ACRE.acreBTC],
          [assets, -assets],
        )
        await expect(tx).to.changeTokenBalances(
          acreBtc,
          [TEST_HOLDER],
          [-shares],
        )

        // Fully exited: no dust position left behind.
        expect(await acreBtc.balanceOf(TEST_HOLDER)).to.equal(0n)
        expect(await acreBtc.totalSupply()).to.equal(supplyBefore - shares)
      })

      it("charges the user nothing to leave", async () => {
        // exitFeeBasisPoints is 0 on mainnet (checked in step 1), so nothing
        // should go to the treasury.
        const receiverAddress = await receiver.getAddress()
        const shares = await acreBtc.balanceOf(TEST_HOLDER)

        await expect(
          acreBtc.connect(holder).redeem(shares, receiverAddress, TEST_HOLDER),
        ).to.changeTokenBalances(tbtc, [ROLES.treasury], [0n])
      })

      it("also supports withdraw(), the asset-denominated entry point", async () => {
        // redeem takes shares, withdraw takes assets. acreBTC does not change
        // either of them. The SDK uses redeem, but withdraw also works on
        // mainnet, so someone integrating with us could call it.
        const receiverAddress = await receiver.getAddress()
        const assets = await acreBtc.previewRedeem(
          await acreBtc.balanceOf(TEST_HOLDER),
        )
        const expectedShares = await acreBtc.previewWithdraw(assets)

        const tx = await acreBtc
          .connect(holder)
          .withdraw(assets, receiverAddress, TEST_HOLDER)

        await expect(tx).to.changeTokenBalances(
          tbtc,
          [receiverAddress],
          [assets],
        )
        await expect(tx).to.changeTokenBalances(
          acreBtc,
          [TEST_HOLDER],
          [-expectedShares],
        )
      })
    })
  })

  // This sits next to step 7, not inside it. Mocha runs the tests of a describe
  // block before its nested describe blocks, and step 7's Bridge test uses the
  // holder's whole remaining position. We use a snapshot so step 7 still has it.
  describe("post-exit - BitcoinRedeemerV2 is dead", () => {
    beforeAfterSnapshotWrapper()

    it("reverts even with the withdrawal queue restored", async () => {
      // MidasAllocator.withdrawShares fails, because the allocator has no
      // Midas shares left. No setting can bring them back.
      await acreBtc
        .connect(governance)
        .updateWithdrawalQueue(ACRE.withdrawalQueue)

      const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          TEST_HOLDER,
          `0x${"00".repeat(20)}`,
          ethers.ZeroHash,
          0,
          0,
          redemptionFixture.redeemerOutputScript,
        ],
      )

      const shares = await acreBtc.balanceOf(TEST_HOLDER)
      // Above the Bridge minimum, so the call fails because the allocator is
      // empty and not because the amount is too small.
      expect(
        await acreBtc.previewRedeem(shares),
        "position too small to clear the dust threshold - the revert would " +
          "prove the wrong thing",
      ).to.be.greaterThan(redemptionFixture.dustThresholdWei)

      await expect(
        acreBtc
          .connect(holder)
          .approveAndCall(ACRE.bitcoinRedeemerV2, shares, extraData),
      ).to.be.reverted
    })
  })

  describe("step 7 - BitcoinRedeemerV3, native BTC", () => {
    let redeemerV3: BitcoinRedeemerV3

    before(async () => {
      const factory = await ethers.getContractFactory(
        "BitcoinRedeemerV3",
        governance,
      )
      // deployProxy returns a general BaseContract type, so we cast it to the
      // generated type instead of leaving it unchecked.
      redeemerV3 = (await upgrades.deployProxy(
        factory,
        [EXTERNAL.tbtc, ACRE.acreBTC, EXTERNAL.tbtcVault],
        { kind: "transparent", initialOwner: ROLES.governance },
      )) as unknown as BitcoinRedeemerV3
      await redeemerV3.waitForDeployment()
    })

    it("deploys wired to acreBTC and the real TBTCVault", async () => {
      expect(await redeemerV3.acreBtc()).to.equal(ACRE.acreBTC)
      expect(await redeemerV3.tbtcToken()).to.equal(EXTERNAL.tbtc)
      expect(await redeemerV3.tbtcVault()).to.equal(EXTERNAL.tbtcVault)
      expect(await redeemerV3.owner()).to.equal(ROLES.governance)
    })

    it("accepts updateTbtcVault from the owner", async () => {
      await expect(
        redeemerV3.connect(governance).updateTbtcVault(EXTERNAL.tbtcVault),
      ).to.emit(redeemerV3, "TbtcVaultUpdated")
    })

    it("gets a redemption accepted by the real tBTC Bridge", async () => {
      expect(
        redemptionFixture.validAtBlock,
        "redemption fixture was derived for a different block - see the header " +
          "of data/redemption.ts for how to rederive it",
      ).to.equal(FORK_BLOCK)

      const extraData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes20", "bytes32", "uint32", "uint64", "bytes"],
        [
          TEST_HOLDER,
          redemptionFixture.walletPubKeyHash,
          redemptionFixture.mainUtxo.txHash,
          redemptionFixture.mainUtxo.txOutputIndex,
          redemptionFixture.mainUtxo.txOutputValue,
          redemptionFixture.redeemerOutputScript,
        ],
      )

      // Size above the Bridge dust threshold; V3 is a pure V1 clone and has no
      // guard of its own.
      const shares = await acreBtc.balanceOf(TEST_HOLDER)
      const assets = await acreBtc.previewRedeem(shares)
      expect(
        assets,
        "holder position is below the Bridge dust threshold",
      ).to.be.greaterThan(redemptionFixture.dustThresholdWei)

      const bridge = await atExternal<IBridge>("Bridge")

      // Check the Bridge accepted our request, not just that some redemption
      // happened. The wallet, the output script and the refund address must all
      // match what V3 sent. We do not check the amount and fees, because the
      // Bridge works those out itself in satoshi.
      await expect(
        acreBtc
          .connect(holder)
          .approveAndCall(await redeemerV3.getAddress(), shares, extraData),
      )
        .to.emit(bridge, "RedemptionRequested")
        .withArgs(
          redemptionFixture.walletPubKeyHash,
          redemptionFixture.redeemerOutputScript,
          TEST_HOLDER,
          anyValue,
          anyValue,
          anyValue,
        )
    })
  })
})
