import React from "react"
import { Box, BoxProps } from "@chakra-ui/react"

type AnimatedNumberSeparatorProps = BoxProps & {
  children: "," | "."
}

function AnimatedNumberSeparator(props: AnimatedNumberSeparatorProps) {
  const { children, ...restProps } = props

  return <Box {...restProps}>{children}</Box>
}

export default AnimatedNumberSeparator
