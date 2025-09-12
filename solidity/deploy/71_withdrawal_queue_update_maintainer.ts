import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, maintainer } = await getNamedAccounts()

  await deployments.execute(
    "WithdrawalQueue",
    {
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    },
    "addMaintainer",
    maintainer,
  )
}

export default func

func.tags = ["WithdrawalQueueUpdateMaintainer"]
func.dependencies = ["WithdrawalQueue"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
