import { defineStyle, defineStyleConfig } from "@chakra-ui/react"

const variantBicolor = defineStyle({
  color: "acre.50",
  borderTopColor: "brown.20",
  borderBottomColor: "brown.20",
  borderLeftColor: "brown.20",
})

const variantUnicolor = defineStyle({
  color: "acre.50",
  borderBottomColor: "acre.50",
})

const variants = {
  bicolor: variantBicolor,
  unicolor: variantUnicolor,
}

// TODO:  Confirm with the design
const sizeXl = defineStyle({
  borderWidth: 3,
  width: 20,
  height: 20,
})

const sizeLg = defineStyle({
  borderWidth: 3,
  width: 14,
  height: 14,
})

const sizeMd = defineStyle({
  borderWidth: 2,
  width: 6,
  height: 6,
})

// TODO:  Confirm with the design
const sizeSm = defineStyle({
  borderWidth: 2,
  width: 4,
  height: 4,
})

const sizes = {
  xl: sizeXl,
  lg: sizeLg,
  md: sizeMd,
  sm: sizeSm,
}

export default defineStyleConfig({
  defaultProps: {
    variant: "bicolor",
  },
  sizes,
  variants,
})
