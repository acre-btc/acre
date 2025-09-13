import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer } = await getNamedAccounts()

  const minimumDepositAmount = 10000000000000 // 0.00001 tBTC

  await deployments.execute(
    "acreBTC",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateMinimumDepositAmount",
    minimumDepositAmount,
  )
}

export default func

func.tags = ["acreBTCUpdateMinimumDepositAmount"]
// func.dependencies = ["acreBTC"]

// Run only on Sepolia testnet.
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name !== "sepolia")
