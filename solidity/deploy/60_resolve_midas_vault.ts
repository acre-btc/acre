import type { DeployFunction } from "hardhat-deploy/types"
import type { HardhatRuntimeEnvironment } from "hardhat/types"
import { isNonZeroAddress } from "../helpers/address"
import { waitConfirmationsNumber } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments } = hre
  const { log } = deployments
  const { deployer } = await getNamedAccounts()

  const midasVault = await deployments.getOrNull("MidasVault")

  if (midasVault && isNonZeroAddress(midasVault.address)) {
    log(`using MidasVault contract at ${midasVault.address}`)
  } else if (hre.network.name !== "hardhat") {
    throw new Error("deployed MidasVault contract not found")
  } else {
    log("deploying Midas Vault contract stub")

    await deployments.deploy("MidasVaultShares", {
      contract: "MidasVaultSharesStub",
      args: ["MidasVaultShares", "MVS"],
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    })

    const { address: tbtcAddress } = await deployments.get("TBTC")
    const { address: midasVaultSharesAddress } =
      await deployments.get("MidasVaultShares")

    await deployments.deploy("MidasVault", {
      contract: "MidasVaultStub",
      args: [tbtcAddress, midasVaultSharesAddress],
      from: deployer,
      log: true,
      waitConfirmations: waitConfirmationsNumber(hre),
    })
  }
}

export default func

func.tags = ["MidasVault"]
