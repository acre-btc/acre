import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, governance } = await getNamedAccounts()
  const { log } = deployments

  log(`transferring ownership of BitcoinDepositorV2 contract to ${governance}`)

  await deployments.execute(
    "BitcoinDepositorV2",
    { from: deployer, log: true, waitConfirmations: 1 },
    "transferOwnership",
    governance,
  )

  if (hre.network.name !== "mainnet" && hre.network.name !== "integration") {
    await deployments.execute(
      "BitcoinDepositorV2",
      { from: governance, log: true, waitConfirmations: 1 },
      "acceptOwnership",
    )
  }
}

export default func

func.tags = ["TransferOwnershipBitcoinDepositorV2"]
func.dependencies = ["BitcoinDepositorV2"]
func.runAtTheEnd = true
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
