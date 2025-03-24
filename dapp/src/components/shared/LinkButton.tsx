import React from "react"
import { Button, ButtonProps, Icon, Link, LinkProps } from "@chakra-ui/react"
import { IconArrowUpRight } from "@tabler/icons-react"

export type LinkButtonProps = ButtonProps & LinkProps

export default function LinkButton({ children, ...props }: LinkButtonProps) {
  return (
    <Button
      as={Link}
      variant="link"
      className="link-button"
      textDecoration="none !important"
      rightIcon={
        <Icon
          as={IconArrowUpRight}
          color="acre.50"
          sx={{
            ".link-button:hover &": {
              color: "currentColor",
            },
            ".link-button:active &": {
              color: "currentColor",
            },
            ".link-button[disabled] &": {
              color: "currentColor",
            },
          }}
        />
      }
      {...props}
    >
      {children}
    </Button>
  )
}
