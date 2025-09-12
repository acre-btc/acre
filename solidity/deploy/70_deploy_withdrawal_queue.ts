import type { HardhatRuntimeEnvironment } from "hardhat/types"
import type { DeployFunction } from "hardhat-deploy/types"
import { waitForTransaction } from "../helpers/deployment"

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments, helpers } = hre
  const { governance } = await getNamedAccounts()
  const { deployer: deployerSigner } = await helpers.signers.getNamedSigners()
  const { log } = deployments

  const tbtc = await deployments.get("TBTC")
  const midasVault = await deployments.get("MidasVault")
  const midasAllocator = await deployments.get("MidasAllocator")
  const tbtcVault = await deployments.get("TBTCVault")
  const acreBtc = await deployments.get("acreBTC")
  const tbtcBridge = await deployments.get("Bridge")

  let deployment = await deployments.getOrNull("WithdrawalQueue")
  if (deployment && helpers.address.isValid(deployment.address)) {
    log(`using WithdrawalQueue at ${deployment.address}`)
  } else {
    ;[, deployment] = await helpers.upgrades.deployProxy("WithdrawalQueue", {
      contractName: "WithdrawalQueue",
      initializerArgs: [
        tbtc.address,
        midasVault.address,
        midasAllocator.address,
        tbtcVault.address,
        acreBtc.address,
        tbtcBridge.address,
      ],
      factoryOpts: {
        signer: deployerSigner,
      },
      proxyOpts: {
        kind: "transparent",
        initialOwner: governance,
      },
    })

    if (deployment.transactionHash && hre.network.tags.etherscan) {
      await waitForTransaction(hre, deployment.transactionHash)
      await helpers.etherscan.verify(deployment)
    }

    // TODO: Add Tenderly verification
  }
}

export default func

func.tags = ["WithdrawalQueue"]
func.dependencies = [
  "TBTC",
  "MidasVault",
  "MidasAllocator",
  "TBTCVault",
  "acreBTC",
  "Bridge",
]
