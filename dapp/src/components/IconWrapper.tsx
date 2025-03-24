import React from "react"
import { Box, HStack, Icon, IconProps } from "@chakra-ui/react"

type IconWrapperProps = {
  icon: typeof Icon
  children: React.ReactNode
} & IconProps

export default function IconWrapper({
  icon,
  children,
  ...props
}: IconWrapperProps) {
  return (
    <HStack position="relative" justifyContent="center">
      <Icon as={icon} {...props} />
      <Box position="absolute">{children}</Box>
    </HStack>
  )
}
