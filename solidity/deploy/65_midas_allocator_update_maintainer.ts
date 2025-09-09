import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, maintainer } = await getNamedAccounts()

  await deployments.execute(
    "MidasAllocator",
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

func.tags = ["MidasAllocatorAddMaintainer"]
// func.dependencies = ["MidasAllocator"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
