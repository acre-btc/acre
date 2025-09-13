import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitForTransaction } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments, helpers } = hre
  const { governance } = await getNamedAccounts()
  const { deployer } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const acreBtc = await deployments.get("acreBTC")
  const tbtc = await deployments.get("TBTC")
  const midasVault = await deployments.get("MidasVault")

  let deployment = await deployments.getOrNull("MidasAllocator")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using MidasAllocator at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy("MidasAllocator", {
      factoryOpts: {
        signer: deployer,
      },
      initializerArgs: [tbtc.address, acreBtc.address, midasVault.address],
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

func.tags = ["MidasAllocator"]
func.dependencies = ["TBTC", "acreBTC", "MidasVault"]
