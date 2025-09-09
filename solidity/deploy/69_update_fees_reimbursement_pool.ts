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
    "BitcoinDepositorV2",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateFeesReimbursementPool",
    feesReimbursementPool.address,
  )
}

export default func

func.tags = ["UpdateFeesReimbursementPool"]
func.dependencies = ["BitcoinDepositorV2", "FeesReimbursementPool"]

// Run only on Hardhat network. On all other networks this function needs to be
// called by the governance.
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name !== "hardhat")
