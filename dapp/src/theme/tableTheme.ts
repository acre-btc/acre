import { createMultiStyleConfigHelpers } from "@chakra-ui/react"
import { tableAnatomy as parts } from "@chakra-ui/anatomy"

const helpers = createMultiStyleConfigHelpers(parts.keys)

const baseStyle = helpers.definePartsStyle({
  th: {
    fontWeight: "medium",
    textTransform: "unset",
    letterSpacing: "0px",
    borderBottom: "0px",
    color: "neutral.60",
  },
  td: {
    borderBottom: "0px",
    bg: "surface.2",
    fontWeight: "medium",
  },
  tfoot: {
    td: {
      bg: "unset",
    },
  },
})

const sizes = {
  md: helpers.definePartsStyle({
    table: {
      borderCollapse: "separate",
      borderSpacing: "0 8px",
      mb: -2, // To normalize bottom spacing
    },
    th: {
      fontSize: "sm",
      lineHeight: 5,
      pt: 0,
      px: 5,
      pb: 1,
      ":first-of-type": { pl: 0 },
      ":last-of-type": { pr: 0 },
    },
    td: {
      p: 5,
      fontSize: "sm",
      ":first-of-type": { roundedLeft: "sm" },
      ":last-of-type": { roundedRight: "sm" },
    },
    tfoot: {
      td: {
        p: 0,
        pt: 3,
        fontSize: "sm",
      },
    },
  }),
}

export default helpers.defineMultiStyleConfig({
  baseStyle,
  sizes,
  defaultProps: {
    variant: "unstyled",
  },
})
