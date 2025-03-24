import React, { useState } from "react"
import { Tooltip as ChakraTooltip, TooltipProps, Flex } from "@chakra-ui/react"

export default function Tooltip(props: TooltipProps) {
  const { children, ...restProps } = props
  const [isOpen, setIsOpen] = useState(false)

  return (
    <ChakraTooltip isOpen={isOpen} {...restProps}>
      <Flex
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </Flex>
    </ChakraTooltip>
  )
}
