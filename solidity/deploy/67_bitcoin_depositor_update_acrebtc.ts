import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre

  const { deployer } = await getNamedAccounts()
  const { log } = deployments

  const acreBtc = await deployments.get("acreBTC")

  log(`updating Acre Vault of BitcoinDepositor to ${acreBtc.address}`)

  await deployments.execute(
    "BitcoinDepositor",
    { from: deployer, log: true, waitConfirmations: 1 },
    "updateAcreVault",
    acreBtc.address,
  )
}

export default func

func.tags = ["UpdateBitcoinDepositorAcreVault"]
func.dependencies = ["BitcoinDepositor", "acreBTC"]

// Run only on Hardhat network. On all other networks this function needs to be
// called by the governance.
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name !== "hardhat")
