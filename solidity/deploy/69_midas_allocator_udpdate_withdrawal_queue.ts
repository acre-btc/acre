import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const withdrawalQueue = await deployments.get("WithdrawalQueue")

  await deployments.execute(
    "MidasAllocator",
    {
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    },
    "setWithdrawalQueue",
    withdrawalQueue.address,
  )
}

export default func

func.tags = ["MidasAllocatorUpdateWithdrawalQueue"]
func.dependencies = ["MidasAllocator", "WithdrawalQueue"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
