import { config, ethers, network } from "hardhat"
import { setBalance } from "@nomicfoundation/hardhat-toolbox/network-helpers"
import type {
  BaseContract,
  ContractTransactionResponse,
  InterfaceAbi,
  Signer,
} from "ethers"

import type {
  MidasAccessControl,
  MidasDataFeed,
  MidasRedemptionVault,
} from "../../../typechain/external"

import acreBtcDeployment from "../../../deployments/mainnet/acreBTC.json"
import bitcoinDepositorV2Deployment from "../../../deployments/mainnet/BitcoinDepositorV2.json"
import bitcoinRedeemerV2Deployment from "../../../deployments/mainnet/BitcoinRedeemerV2.json"
import midasAllocatorDeployment from "../../../deployments/mainnet/MidasAllocator.json"
import withdrawalQueueDeployment from "../../../deployments/mainnet/WithdrawalQueue.json"
import bridgeArtifact from "../../../external/mainnet/Bridge.json"
import midasAccessControlArtifact from "../../../external/mainnet/MidasAccessControl.json"
import midasDataFeedArtifact from "../../../external/mainnet/MidasDataFeed.json"
import midasRedemptionVaultArtifact from "../../../external/mainnet/MidasRedemptionVault.json"
import midasShareTokenArtifact from "../../../external/mainnet/MidasShareToken.json"
import midasVaultArtifact from "../../../external/mainnet/MidasVault.json"
import tbtcArtifact from "../../../external/mainnet/TBTC.json"
import tbtcVaultArtifact from "../../../external/mainnet/TBTCVault.json"

/**
 * Helpers for the Midas exit fork test.
 *
 * We reach the Midas contracts through the artifacts in `external/mainnet/`.
 * Typechain turns their ABIs into types under `typechain/external` (see the
 * `typechain:external` script, which `build` runs). The address, the ABI and
 * the type all come from the same file, so they cannot get out of sync.
 *
 * NOTE: if you change FORK_BLOCK you must also redo `data/redemption.ts`. The
 * tBTC Bridge only accepts a redemption that names a Live wallet and that
 * wallet's current main UTXO, and both change over time. The header of that
 * file explains how the values were found.
 */
export const FORK_BLOCK = Number(process.env.MAINNET_FORK_BLOCK ?? 25889595)

/** Status values of a Midas redemption request. */
export const REQUEST_PENDING = 0n
export const REQUEST_PROCESSED = 1n
export const REQUEST_CANCELED = 2n

/**
 * Acre contracts on mainnet. We read the addresses from the deployment files
 * instead of writing them here again, so `deployments/mainnet` stays the one
 * place they live. If a contract is redeployed, this test follows.
 */
export const ACRE = {
  acreBTC: acreBtcDeployment.address,
  midasAllocator: midasAllocatorDeployment.address,
  withdrawalQueue: withdrawalQueueDeployment.address,
  bitcoinRedeemerV2: bitcoinRedeemerV2Deployment.address,
  bitcoinDepositorV2: bitcoinDepositorV2Deployment.address,
}

/** External protocol contracts, from the vendored `external/mainnet` artifacts. */
export const EXTERNAL = {
  tbtc: tbtcArtifact.address,
  tbtcVault: tbtcVaultArtifact.address,
  bridge: bridgeArtifact.address,
}

/**
 * Midas contracts on mainnet.
 *
 * `MidasVault` in `external/mainnet` is only the adapter. The vault that really
 * pays out is behind it, and you can only find it by asking the adapter. The
 * call chain is:
 *
 *   MidasAllocator.emergencyWithdraw()
 *     -> AcreAdapter.requestRedeem(shares, acreBTC)
 *     -> AcreBtcRedemptionVault.redeemRequest(tBTC, shares, recipient)
 *
 * After that, one `approveRequest` call from the vault admin pays the tBTC out.
 */
export const MIDAS = {
  /** `AcreAdapter` - what `MidasAllocator.midasVault()` points at. */
  adapter: midasVaultArtifact.address,
  /** `AcreBtcRedemptionVaultWithSwapper` proxy. */
  redemptionVault: midasRedemptionVaultArtifact.address,
  /** mTBTC - the Midas share token held by MidasAllocator. */
  mToken: midasShareTokenArtifact.address,
  /** Price feed used to size the payout at settlement time. */
  mTokenDataFeed: midasDataFeedArtifact.address,
  accessControl: midasAccessControlArtifact.address,
  /**
   * These are accounts, not contracts, so there is no artifact file for them.
   * We write them down on purpose. Step 1 compares them with the chain, so if
   * Midas changes who approves or where the tBTC comes from, the test fails
   * clearly instead of quietly using the new setup.
   */
  /** Holds ACRE_BTC_REDEMPTION_VAULT_ADMIN_ROLE; the account that settles. */
  vaultAdmin: "0x2ACB4BdCbEf02f81BF713b696Ac26390d7f79A12",
  /** DEFAULT_ADMIN_ROLE holder, used to re-grant if the role ever moves. */
  accessControlAdmin: "0xd4195CF4df289a4748C1A7B6dDBE770e27bA1227",
  /** tBTC payouts are pulled from here, not from the vault's own balance. */
  requestRedeemer: "0x910CA844Fb578f670Ca5190c1cF4ab851155Bf99",
} as const

type NamedAccountSpec = Record<string, string | number>

/**
 * On the `hardhat` network `getNamedAccounts()` gives local test accounts, not
 * the real ones. Only the `mainnet` and `integration` entries hold the real
 * addresses, so we read those from hardhat.config.ts instead of writing them
 * here again.
 */
function mainnetNamedAccount(name: string): string {
  const specs = config.namedAccounts as
    | Record<string, NamedAccountSpec>
    | undefined
  const value = specs?.[name]?.mainnet
  if (typeof value !== "string") {
    throw new Error(
      `namedAccounts.${name}.mainnet is missing from hardhat.config.ts`,
    )
  }
  return value
}

/** Acre role holders, mainnet. */
export const ROLES = {
  governance: mainnetNamedAccount("governance"),
  maintainer: mainnetNamedAccount("maintainer"),
  pauseAdmin: mainnetNamedAccount("pauseAdmin"),
  treasury: mainnetNamedAccount("treasury"),
}

/**
 * A real acreBTC holder that we impersonate. It is the OrangeKit Safe that made
 * WithdrawalQueue requests 1 and 3. Setup checks it still holds shares, so if
 * this account ever exits we get a clear error instead of a confusing one.
 */
export const TEST_HOLDER = "0xDcBC417BC341d1974d88B78Ac460e4e9306b9Ee0"

export const ROLE_REDEMPTION_VAULT_ADMIN = ethers.id(
  "ACRE_BTC_REDEMPTION_VAULT_ADMIN_ROLE",
)

/** Selector of `redeemRequest(address,uint256,address)` - custom-recipient path. */
export const REDEEM_REQUEST_CUSTOM_RECIPIENT_SELECTOR = ethers
  .id("redeemRequest(address,uint256,address)")
  .slice(0, 10)

export const APPROVE_REQUEST_SELECTOR = ethers
  .id("approveRequest(uint256,uint256)")
  .slice(0, 10)

export function forkingConfigured(): boolean {
  return Boolean(process.env.MAINNET_RPC_URL)
}

/**
 * Points the local Hardhat network at a fork of mainnet at FORK_BLOCK.
 *
 * We do this here instead of using hardhat.config.ts, because the fork block
 * there is 20971177. That block is older than acreBTC, MidasAllocator and the
 * WithdrawalQueue, so none of the contracts we need exist at it.
 * `helpers.forking.resetFork()` does not work either, because it needs
 * `network.config.forking.url`, which is only set when FORKING=true.
 */
export async function resetToMainnetFork(): Promise<void> {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: FORK_BLOCK,
        },
      },
    ],
  })
}

/** Impersonate and fund, without depending on a funding signer. */
export async function impersonate(address: string): Promise<Signer> {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  })
  await setBalance(address, ethers.parseEther("100"))
  return ethers.getSigner(address)
}

/**
 * Connects to a contract that is already deployed on mainnet, using the ABI in
 * `deployments/mainnet`. We do not use the locally compiled one, because the
 * code in this repo may differ from what is really deployed, and this test is
 * about testing the deployed code.
 */
interface DeploymentArtifact {
  address: string
  abi: InterfaceAbi
}

/** Imported directly so that a wrong name is a compile error. */
const DEPLOYMENTS = {
  acreBTC: acreBtcDeployment,
  MidasAllocator: midasAllocatorDeployment,
  WithdrawalQueue: withdrawalQueueDeployment,
  BitcoinRedeemerV2: bitcoinRedeemerV2Deployment,
  BitcoinDepositorV2: bitcoinDepositorV2Deployment,
}

export async function atDeployment<T extends BaseContract>(
  name: keyof typeof DEPLOYMENTS,
  signer?: Signer,
): Promise<T> {
  const artifact = DEPLOYMENTS[name] as unknown as DeploymentArtifact
  const runner = signer ?? (await ethers.provider.getSigner(0))
  return new ethers.BaseContract(
    artifact.address,
    artifact.abi,
    runner,
  ) as unknown as T
}

/**
 * Artifacts for contracts we do not own. The Midas ones were added by hand,
 * because Midas does not publish its contracts to npm.
 */
const EXTERNAL_ARTIFACTS = {
  TBTC: tbtcArtifact,
  TBTCVault: tbtcVaultArtifact,
  Bridge: bridgeArtifact,
  MidasVault: midasVaultArtifact,
  MidasRedemptionVault: midasRedemptionVaultArtifact,
  MidasAccessControl: midasAccessControlArtifact,
  MidasDataFeed: midasDataFeedArtifact,
  MidasShareToken: midasShareTokenArtifact,
}

export async function atExternal<T extends BaseContract>(
  name: keyof typeof EXTERNAL_ARTIFACTS,
  signer?: Signer,
): Promise<T> {
  const artifact = EXTERNAL_ARTIFACTS[name] as unknown as DeploymentArtifact
  const runner = signer ?? (await ethers.provider.getSigner(0))
  return new ethers.BaseContract(
    artifact.address,
    artifact.abi,
    runner,
  ) as unknown as T
}

/**
 * Finishes the Midas redemption that `MidasAllocator.emergencyWithdraw()` left
 * waiting, the same way a person at Midas would.
 *
 * `emergencyWithdraw()` does not move any tBTC. It only asks for it:
 *
 *   MidasAllocator.emergencyWithdraw()
 *     -> AcreAdapter.requestRedeem(shares, acreBTC)
 *     -> AcreBtcRedemptionVault.redeemRequest(tBTC, shares, acreBTC)
 *
 * After that call the Midas vault holds the allocator's mTBTC, the request is
 * `Pending` with `sender = acreBTC`, and `acreBTC.totalAssets()` has dropped to
 * about 0. On mainnet someone at Midas approves the request within about an
 * hour and the tBTC arrives on acreBTC. On a fork nobody does that, so the exit
 * would stop half way and step 5 could never check that the money comes back.
 * This function does that missing part.
 *
 * It is not a fake. `approveRequest` is the real function Midas uses. It moves
 * tBTC from `requestRedeemer` to `request.sender`, burns the mTBTC held by the
 * vault, and marks the request `Processed`. The only thing we stand in for is
 * the person who decides to approve.
 *
 * We check the vault's settings first, so that if Midas changes something we
 * get a clear error instead of an unexplained revert from their contract.
 *
 * @param requestId The Midas request id emitted by `emergencyWithdraw()` in the
 *        vault's `RedeemRequestWithCustomRecipient` event.
 * @returns The `approveRequest` transaction, which is the one that moves the
 *          tBTC. Callers can use it with `changeTokenBalances`. The other
 *          transactions this function sends happen in earlier blocks, so that
 *          check does not see them.
 */
export async function settleMidasRequest(
  requestId: bigint,
): Promise<ContractTransactionResponse> {
  const vault = await atExternal<MidasRedemptionVault>("MidasRedemptionVault")
  const accessControl =
    await atExternal<MidasAccessControl>("MidasAccessControl")

  const problems: string[] = []
  if (await vault.paused()) problems.push("redemption vault is paused")
  if (await vault.fnPaused(APPROVE_REQUEST_SELECTOR))
    problems.push("approveRequest is fn-paused")
  if ((await vault.vaultRole()) !== ROLE_REDEMPTION_VAULT_ADMIN)
    problems.push("vaultRole() no longer ACRE_BTC_REDEMPTION_VAULT_ADMIN_ROLE")
  if (problems.length > 0) {
    throw new Error(
      `Midas settlement preconditions failed: ${problems.join("; ")}`,
    )
  }

  // Use the real account that holds the role. If Midas has given the role to
  // someone else since this test was written, use the admin account to grant it
  // again. This is still the real contract code, only a different account.
  const adminAddress = MIDAS.vaultAdmin
  if (
    !(await accessControl.hasRole(ROLE_REDEMPTION_VAULT_ADMIN, adminAddress))
  ) {
    const acAdmin = await impersonate(MIDAS.accessControlAdmin)
    await accessControl
      .connect(acAdmin)
      .grantRole(ROLE_REDEMPTION_VAULT_ADMIN, adminAddress)
  }

  const feed = await atExternal<MidasDataFeed>("MidasDataFeed")
  const rate = await feed.getDataInBase18()

  const admin = await impersonate(adminAddress)
  return vault.connect(admin).approveRequest(requestId, rate)
}
