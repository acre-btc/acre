import { Chain } from "#/types"
import { BitcoinNetwork } from "@acre-btc/sdk"
import env from "./env"

const BLOCK_EXPLORER_TESTNET = {
  bitcoin: { title: "Mempool", url: "https://mempool.space/testnet" },
  ethereum: { title: "Etherscan", url: "https://sepolia.etherscan.io/" },
}

const BLOCK_EXPLORER_MAINNET = {
  bitcoin: { title: "Mempool", url: "https://mempool.space" },
  ethereum: { title: "Etherscan", url: "https://etherscan.io/" },
}

const BLOCK_EXPLORER: Record<Chain, { title: string; url: string }> =
  env.USE_TESTNET ? BLOCK_EXPLORER_TESTNET : BLOCK_EXPLORER_MAINNET

const BITCOIN_NETWORK: BitcoinNetwork = env.USE_TESTNET
  ? BitcoinNetwork.Testnet
  : BitcoinNetwork.Mainnet

export default {
  BLOCK_EXPLORER,
  BITCOIN_NETWORK,
}
