import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { waitForTransaction } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, helpers, getNamedAccounts } = hre
  const { governance } = await getNamedAccounts()
  const { deployer } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const tbtc = await deployments.get("TBTC")
  const bridge = await deployments.get("Bridge")
  const tbtcVault = await deployments.get("TBTCVault")
  const acreBtc = await deployments.get("acreBTC")

  let deployment = await deployments.getOrNull("BitcoinDepositorV2")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using BitcoinDepositorV2 at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy("BitcoinDepositorV2", {
      factoryOpts: {
        signer: deployer,
      },
      initializerArgs: [
        bridge.address,
        tbtcVault.address,
        tbtc.address,
        acreBtc.address,
      ],
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

func.tags = ["BitcoinDepositorV2"]
func.dependencies = ["TBTC", "acreBTC"]
