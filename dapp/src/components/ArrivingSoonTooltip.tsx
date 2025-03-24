import React, { ReactNode } from "react"
import Tooltip from "./Tooltip"

export default function ArrivingSoonTooltip({
  label,
  shouldDisplayTooltip,
  children,
}: {
  label?: string
  shouldDisplayTooltip: boolean
  children: ReactNode
}) {
  return shouldDisplayTooltip ? (
    <Tooltip label={label ?? "Arriving Soon"}>{children}</Tooltip>
  ) : (
    children
  )
}
