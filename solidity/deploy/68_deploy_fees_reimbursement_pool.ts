import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { waitForTransaction } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, helpers, getNamedAccounts } = hre
  const { governance } = await getNamedAccounts()
  const { deployer } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const tbtcToken = await deployments.get("TBTC")
  const bitcoinDepositor = await deployments.get("BitcoinDepositorV2")

  let deployment = await deployments.getOrNull("FeesReimbursementPool")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using FeesReimbursementPool at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy(
      "FeesReimbursementPool",
      {
        contractName: "FeesReimbursementPool",
        initializerArgs: [tbtcToken.address, bitcoinDepositor.address],
        factoryOpts: { signer: deployer },
        proxyOpts: {
          kind: "transparent",
          initialOwner: governance,
        },
      },
    )

    if (deployment.transactionHash && hre.network.tags.etherscan) {
      await waitForTransaction(hre, deployment.transactionHash)
      await helpers.etherscan.verify(deployment)
    }

    // TODO: Add Tenderly verification
  }
}

export default func

func.tags = ["FeesReimbursementPool"]
func.dependencies = ["BitcoinDepositorV2", "TBTC"]
