import { deployments } from "hardhat"
import { getDeployedContract } from "./contract"

import type {
  StBTC as stBTC,
  AcreBTC as acreBTC,
  BridgeStub,
  TBTCVaultStub,
  MezoAllocator,
  BitcoinDepositor,
  BitcoinRedeemer,
  TestTBTC,
  AcreMultiAssetVault,
  MezoPortalStub,
  FeesReimbursementPool,
} from "../../typechain"

// eslint-disable-next-line import/prefer-default-export
export async function deployment() {
  await deployments.fixture()

  const stbtc: stBTC = await getDeployedContract("stBTC")
  const bitcoinDepositor: BitcoinDepositor =
    await getDeployedContract("BitcoinDepositor")
  const bitcoinRedeemer: BitcoinRedeemer =
    await getDeployedContract("BitcoinRedeemer")
  const feesReimbursementPool: FeesReimbursementPool =
    await getDeployedContract("FeesReimbursementPool")

  const multiAssetVault: AcreMultiAssetVault = await getDeployedContract(
    "AcreMultiAssetVault",
  )

  const tbtc: TestTBTC = await getDeployedContract("TBTC")
  const tbtcBridge: BridgeStub = await getDeployedContract("Bridge")
  const tbtcVault: TBTCVaultStub = await getDeployedContract("TBTCVault")

  const mezoAllocator: MezoAllocator =
    await getDeployedContract("MezoAllocator")
  const mezoPortal: MezoPortalStub = await getDeployedContract("MezoPortal")

  const acreBtc: acreBTC = await getDeployedContract("acreBTC")

  return {
    tbtc,
    stbtc,
    bitcoinDepositor,
    bitcoinRedeemer,
    feesReimbursementPool,
    multiAssetVault,
    tbtcBridge,
    tbtcVault,
    mezoAllocator,
    mezoPortal,
    acreBtc,
  }
}
