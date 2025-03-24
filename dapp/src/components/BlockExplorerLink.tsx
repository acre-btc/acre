import React from "react"
import { Chain, ExplorerDataType } from "#/types"
import { Link, LinkProps } from "@chakra-ui/react"
import { chainUtils } from "#/utils"

type BlockExplorerLinkProps = {
  id: string
  type: ExplorerDataType
  chain?: Chain
} & Omit<LinkProps, "isExternal">

function BlockExplorerLink({
  id,
  type,
  chain = "bitcoin",
  children,
  ...restProps
}: BlockExplorerLinkProps) {
  const { link, title } = chainUtils.createLinkToBlockExplorerForChain(
    chain,
    id,
    type,
  )

  // TODO: Update when ButtonLink is ready
  return (
    <Link href={link} isExternal {...restProps}>
      {children ?? title}
    </Link>
  )
}

export default BlockExplorerLink
