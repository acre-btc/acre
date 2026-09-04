import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { waitForTransaction } from "../helpers/deployment"

/**
 * Deploys `BitcoinRedeemerV3` - the synchronous acreBTC -> BTC redeemer.
 *
 * This is a fresh proxy, not an upgrade of `BitcoinRedeemerV2`. V2 routes
 * through the Midas `WithdrawalQueue`, which stops working once
 * `MidasAllocator.emergencyWithdraw()` has moved the Midas shares out - so it is
 * left deployed and inert as a rollback story rather than being replaced.
 *
 * Unlike V2, `tbtcVault` is set in the initializer, so no follow-up
 * `updateTbtcVault` transaction is needed after deployment.
 */
const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, helpers, getNamedAccounts } = hre
  const { governance } = await getNamedAccounts()
  const { deployer } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const tbtc = await deployments.get("TBTC")
  const acreBtc = await deployments.get("acreBTC")
  const tbtcVault = await deployments.get("TBTCVault")

  let deployment = await deployments.getOrNull("BitcoinRedeemerV3")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using BitcoinRedeemerV3 at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy("BitcoinRedeemerV3", {
      contractName: "BitcoinRedeemerV3",
      initializerArgs: [tbtc.address, acreBtc.address, tbtcVault.address],
      factoryOpts: { signer: deployer },
      proxyOpts: {
        kind: "transparent",
        initialOwner: governance,
      },
    })

    if (deployment.transactionHash && hre.network.tags.etherscan) {
      await waitForTransaction(hre, deployment.transactionHash)
      await helpers.etherscan.verify(deployment)
    }

    // TODO: Add Tenderly verification
  }
}

export default func

func.tags = ["BitcoinRedeemerV3"]
func.dependencies = ["TBTC", "acreBTC", "TBTCVault"]
