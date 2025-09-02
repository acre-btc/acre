import { AcreContracts } from "../contracts"
import { EthereumContractRunner } from "./contract"
import { EthereumBitcoinDepositor } from "./bitcoin-depositor"
import { EthereumNetwork } from "./network"
import { EthereumAcreBTC } from "./acrebtc"
import EthereumBitcoinRedeemer from "./bitcoin-redeemer"
import TbtcBridge from "./tbtc-bridge"
import TbtcVault from "./tbtc-vault"
import ERC20Token from "./erc20-token"

export * from "./bitcoin-depositor"
export * from "./address"
export { EthereumContractRunner }

async function initializeTbtcContracts(
  runner: EthereumContractRunner,
  bitcoinDepositor: EthereumBitcoinDepositor,
): Promise<{
  tbtcBridge: TbtcBridge
  tbtcVault: TbtcVault
  tbtcToken: ERC20Token
}> {
  const tbtcBridgeAddress = await bitcoinDepositor.getTbtcBridgeAddress()
  const tbtcVaultAddress = await bitcoinDepositor.getTbtcVaultAddress()
  const tbtcTokenAddress = await bitcoinDepositor.getTbtcTokenAddress()

  const tbtcBridge = new TbtcBridge(runner, tbtcBridgeAddress)
  const tbtcVault = new TbtcVault(runner, tbtcVaultAddress)
  const tbtcToken = new ERC20Token(runner, tbtcTokenAddress)

  return { tbtcBridge, tbtcVault, tbtcToken }
}

async function getEthereumContracts(
  runner: EthereumContractRunner,
  network: EthereumNetwork,
): Promise<AcreContracts> {
  const bitcoinDepositor = new EthereumBitcoinDepositor({ runner }, network)
  const acreBTC = new EthereumAcreBTC({ runner }, network)
  const bitcoinRedeemer = new EthereumBitcoinRedeemer({ runner }, network)

  const tbtcContracts = await initializeTbtcContracts(runner, bitcoinDepositor)

  bitcoinDepositor.setTbtcContracts(tbtcContracts)
  bitcoinRedeemer.setTbtcContracts(tbtcContracts)

  return { bitcoinDepositor, acreBTC, bitcoinRedeemer }
}

export { getEthereumContracts, EthereumNetwork, EthereumBitcoinRedeemer }
