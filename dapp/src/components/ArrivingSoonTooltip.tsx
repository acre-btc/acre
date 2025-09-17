import React, { ReactNode } from "react"
import Tooltip from "./shared/Tooltip"

export default function ArrivingSoonTooltip({
  label,
  shouldDisplayTooltip,
  children,
}: {
  label?: ReactNode
  shouldDisplayTooltip: boolean
  children: ReactNode
}) {
  return shouldDisplayTooltip ? (
    <Tooltip label={label ?? "Arriving Soon"}>{children}</Tooltip>
  ) : (
    children
  )
}
