import { chains } from "#/constants"
import { Chain, ExplorerDataType } from "#/types"

// At this moment, the function returns
// the correct part of the URL only for the transaction.
//  However, it provides us with an easy way
// to handle the next data for block explorer.
const createBlockExplorerLink = (
  prefix: string,
  id: string,
  type: ExplorerDataType,
) => {
  switch (type) {
    case "address":
      return `${prefix}/address/${id}`
    case "transaction":
    default: {
      return `${prefix}/tx/${id}`
    }
  }
}

const createLinkToBlockExplorerForChain = (
  chain: Chain,
  id: string,
  type: ExplorerDataType,
) => {
  const { title, url } = chains.BLOCK_EXPLORER[chain]
  const link = createBlockExplorerLink(url, id, type)
  return { title, link }
}

export default {
  createBlockExplorerLink,
  createLinkToBlockExplorerForChain,
}
