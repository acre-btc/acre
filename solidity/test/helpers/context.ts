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
  MidasAllocator,
  MidasVaultStub,
  WithdrawalQueue,
  BitcoinRedeemerV2,
  BitcoinDepositorV2,
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

  const midasAllocator: MidasAllocator =
    await getDeployedContract("MidasAllocator")
  const midasVault: MidasVaultStub = await getDeployedContract("MidasVault")

  const withdrawalQueue: WithdrawalQueue =
    await getDeployedContract("WithdrawalQueue")

  const bitcoinDepositorV2: BitcoinDepositorV2 =
    await getDeployedContract("BitcoinDepositorV2")
  const bitcoinRedeemerV2: BitcoinRedeemerV2 =
    await getDeployedContract("BitcoinRedeemerV2")

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
    midasAllocator,
    midasVault,
    withdrawalQueue,
    bitcoinDepositorV2,
    bitcoinRedeemerV2,
  }
}
