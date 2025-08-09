import React from "react"
import { Chain, ExplorerDataType } from "#/types"
import { chainUtils } from "#/utils"
import LinkButton, { LinkButtonProps } from "./LinkButton"

type BlockExplorerLinkProps = {
  id: string
  type: ExplorerDataType
  chain?: Chain
  text?: string
} & Omit<LinkButtonProps, "href" | "isExternal" | "children">

export default function BlockExplorerLink({
  id,
  type,
  text,
  chain = "bitcoin",
  ...props
}: BlockExplorerLinkProps) {
  const { link, title } = chainUtils.createLinkToBlockExplorerForChain(
    chain,
    id,
    type,
  )

  return (
    <LinkButton href={link} isExternal {...props}>
      {text ?? title}
    </LinkButton>
  )
}
