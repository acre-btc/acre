import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, governance } = await getNamedAccounts()
  const { log } = deployments

  log(`transferring ownership of MidasAllocator contract to ${governance}`)

  await deployments.execute(
    "MidasAllocator",
    {
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    },
    "transferOwnership",
    governance,
  )

  if (hre.network.name !== "mainnet" && hre.network.name !== "integration") {
    await deployments.execute(
      "MidasAllocator",
      {
        from: governance,
        log: true,
        waitConfirmations: waitConfirmationsNumber(hre),
      },
      "acceptOwnership",
    )
  }
}

export default func

func.tags = ["TransferOwnershipMidasAllocator"]
func.dependencies = ["MidasAllocator"]
func.skip = async (hre: HardhatRuntimeEnvironment): Promise<boolean> =>
  Promise.resolve(hre.network.name === "integration")
