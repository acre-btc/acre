import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre

  const { deployer } = await getNamedAccounts()
  const { log } = deployments

  const feesReimbursementPool = await deployments.get("FeesReimbursementPool")

  log(
    `updating fees reimbursement pool of BitcoinDepositor to ${feesReimbursementPool.address}`,
  )

  await deployments.execute(
    "BitcoinDepositor",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateFeesReimbursementPool",
    feesReimbursementPool.address,
  )
}

export default func

func.tags = ["UpdateFeesReimbursementPool"]
func.dependencies = ["BitcoinDepositor", "FeesReimbursementPool"]
