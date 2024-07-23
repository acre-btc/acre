import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const dispatcher = await deployments.get("MezoAllocator")

  await deployments.execute(
    "stBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateDispatcher",
    dispatcher.address,
  )
}

export default func

func.tags = ["stBTCUpdateDispatcher"]
func.dependencies = ["stBTC", "MezoAllocator"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
