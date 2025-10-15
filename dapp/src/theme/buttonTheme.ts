import {
  ComponentSingleStyleConfig,
  defineStyle,
  StyleFunctionProps,
} from "@chakra-ui/react"

// TODO: should be updated when style guide will be ready
const variantCard = defineStyle({
  h: 12,
  p: 3,
  pr: 4,
  fontWeight: "semibold",
  bg: "surface.3",
  color: "acre.50",

  _hover: {
    bg: "surface.3",
    textDecoration: "none",
  },
})

// TODO: Update the button styles correctly when ready
const buttonTheme: ComponentSingleStyleConfig = {
  baseStyle: {
    // Remove a blue outline when the button is in focus.
    boxShadow: "none !important",
  },
  sizes: {
    md: {
      fontSize: "sm",
      py: 2,
      borderRadius: "sm",
    },
    lg: {
      fontSize: "md",
      py: 4,
      borderRadius: "sm",
      h: 14,
    },
  },
  variants: {
    solid: ({ colorScheme }: StyleFunctionProps) => {
      let baseBg = `${colorScheme}.400`
      let hoverBg = `${colorScheme}.500`

      if (colorScheme === "oldPalette.green") {
        baseBg = `${colorScheme}.500`
        hoverBg = `${colorScheme}.600`
      }

      return {
        bg: baseBg,
        color: "white",
        _hover: {
          bg: hoverBg,
          _disabled: {
            bg: "oldPalette.grey.400",
          },
        },
        _active: {
          bg: baseBg,
        },
        _loading: {
          _disabled: {
            background: "oldPalette.gold.300",
            opacity: 1,
          },
        },
        _disabled: {
          bg: "oldPalette.grey.500",
          color: "oldPalette.gold.200",
        },
      }
    },
    outline: ({ colorScheme }: StyleFunctionProps) => {
      const defaultStyles = {
        color: "oldPalette.grey.700",
        borderColor: "oldPalette.grey.700",

        _hover: {
          bg: "oldPalette.opacity.grey.700.05",
        },
        _active: {
          bg: "transparent",
        },
        _loading: {
          _disabled: {
            borderColor: "white",
            background: "oldPalette.opacity.white.5",
            opacity: 1,
          },
        },
      }
      if (colorScheme === "oldPalette.gold") {
        return {
          ...defaultStyles,
          bg: "oldPalette.gold.100",
          borderColor: "white",
          borderStyle: "solid",

          _hover: {
            borderColor: "oldPalette.grey.500",
            bg: "transparent",
          },
        }
      }

      if (colorScheme === "white") {
        return {
          ...defaultStyles,
          color: "white",
          borderColor: "white",

          _hover: {
            bg: "oldPalette.opacity.black.05",
          },
        }
      }
      return defaultStyles
    },
    ghost: {
      color: "inherit",
      _hover: {
        bg: "transparent",
      },
      _active: {
        bg: "transparent",
      },
    },
    card: variantCard,
    pagination: {
      bg: "white",
      color: "oldPalette.grey.700",
      ring: 0,
      ringInset: "inset",
      ringColor: "white",

      _hover: {
        color: "acre.50",
        bg: "oldPalette.opacity.white.6",
        ring: 1,
      },
      _active: {
        ring: 1,
        ringColor: "acre.50",
      },
      _disabled: {
        color: "oldPalette.grey.300",
        bg: "white",
        opacity: 1,
        pointerEvents: "none",
      },
    },
    link: {
      bg: "initial",
      color: "inherit",
      p: 0,
      fontWeight: "medium",
      ":hover": { textDecoration: "underline" },
      ":focus-visible": { textDecoration: "underline" },
    },
  },
  defaultProps: {
    colorScheme: "oldPalette.brand",
  },
}

export default buttonTheme
