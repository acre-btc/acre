import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, pauseAdmin } = await getNamedAccounts()
  const { log } = deployments

  log(`updating pause admin account of acreBTC contract to ${pauseAdmin}`)

  await deployments.execute(
    "acreBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updatePauseAdmin",
    pauseAdmin,
  )
}

export default func

func.tags = ["UpdatePauseAdminAcreBTC"]
// func.dependencies = ["acreBTC"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
