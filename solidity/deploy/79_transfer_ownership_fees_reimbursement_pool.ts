import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { deployer, governance } = await getNamedAccounts()
  const { log } = deployments

  log(
    `transferring ownership of FeesReimbursementPool contract to ${governance}`,
  )

  await deployments.execute(
    "FeesReimbursementPool",
    {
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    },
    "transferOwnership",
    governance,
  )

  // Run only on Hardhat network. On all other networks this function needs to
  // be called by the governance.
  if (hre.network.name === "hardhat") {
    await deployments.execute(
      "FeesReimbursementPool",
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

func.tags = ["TransferOwnershipFeesReimbursementPool"]
func.dependencies = ["FeesReimbursementPool"]
