import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const withdrawalQueue = await deployments.get("WithdrawalQueue")

  await deployments.execute(
    "acreBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateWithdrawalQueue",
    withdrawalQueue.address,
  )
}

export default func

func.tags = ["acreBTCUpdateWithdrawalQueue"]
func.dependencies = ["acreBTC", "WithdrawalQueue"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
