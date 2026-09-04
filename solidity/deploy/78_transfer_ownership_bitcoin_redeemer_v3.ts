import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, governance } = await getNamedAccounts()
  const { log } = deployments

  log(`transferring ownership of BitcoinRedeemerV3 contract to ${governance}`)

  await deployments.execute(
    "BitcoinRedeemerV3",
    { from: deployer, log: true, waitConfirmations: 1 },
    "transferOwnership",
    governance,
  )

  // `Ownable2Step` - on mainnet the governance Safe accepts separately, so the
  // deployment leaves `pendingOwner` set and the acceptance is a manual step.
  if (hre.network.name !== "mainnet" && hre.network.name !== "integration") {
    await deployments.execute(
      "BitcoinRedeemerV3",
      { from: governance, log: true, waitConfirmations: 1 },
      "acceptOwnership",
    )
  }
}

export default func

func.tags = ["TransferOwnershipBitcoinRedeemerV3"]
func.dependencies = ["BitcoinRedeemerV3"]
func.runAtTheEnd = true
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
