import { checkboxAnatomy as parts } from "@chakra-ui/anatomy"
import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react"

const multiStyleConfig = createMultiStyleConfigHelpers(parts.keys)

const baseStyleControl = defineStyle({
  border: "1px solid",
  borderColor: "surface.4",
  bg: "surface.1",
  borderRadius: "sm",

  _hover: {
    borderColor: "surface.4",
  },

  _checked: {
    bg: "acre.50",
    borderColor: "acre.50",
    color: "surface.1",

    _hover: {
      bg: "acre.50",
      borderColor: "acre.50",
    },
  },

  _invalid: {
    borderColor: "red.50",
  },
})

const baseStyleLabel = defineStyle({
  color: "text.primary",
  fontWeight: "medium",
})

const baseStyle = multiStyleConfig.definePartsStyle({
  control: baseStyleControl,
  label: baseStyleLabel,
})

export default multiStyleConfig.defineMultiStyleConfig({
  baseStyle,
  defaultProps: {
    size: "md",
  },
})
