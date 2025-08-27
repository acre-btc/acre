import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitForTransaction } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments, helpers } = hre
  const { treasury, governance } = await getNamedAccounts()
  const { deployer: deployerSigner } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const tbtc = await deployments.get("TBTC")

  let deployment = await deployments.getOrNull("acreBTC")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using acreBTC at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy("acreBTC", {
      contractName: "acreBTC",
      initializerArgs: [tbtc.address, treasury],
      factoryOpts: {
        signer: deployerSigner,
      },
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

func.tags = ["acreBTC"]
func.dependencies = ["TBTC"]
