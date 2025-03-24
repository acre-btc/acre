import { defineStyle, defineStyleConfig } from "@chakra-ui/react"

const baseStyle = defineStyle({
  borderRadius: "sm",
  gap: 1,
})

const loadingStyles = defineStyle({
  _disabled: {
    bg: "ivoire.30",
    color: "brown.100",
    opacity: 1,
  },
})

const disabledStyles = defineStyle({
  opacity: 1,
  color: "brown.40",
  bg: "brown.20",
})

const variantSolidAcre = defineStyle(() => ({
  bg: "acre.50",
  color: "ivoire.10",

  _loading: loadingStyles,
  _disabled: disabledStyles,
  _active: { bg: "acre.80" },
  _hover: {
    bg: "acre.60",
    _disabled: disabledStyles,
  },
}))

const variantSolidBrown = defineStyle(() => ({
  bg: "brown.80",
  color: "ivoire.10",

  _loading: loadingStyles,
  _disabled: disabledStyles,
  _active: { bg: "black" },
  _hover: {
    bg: "brown.90",
    _disabled: disabledStyles,
  },
}))

const variantSolidIvoire = defineStyle(() => ({
  bg: "ivoire.10",
  color: "brown.100",

  _loading: loadingStyles,
  _disabled: disabledStyles,
  _active: { bg: "brown.30" },
  _hover: {
    bg: "brown.10",
    _disabled: disabledStyles,
  },
}))

const variantSolid = defineStyle(({ colorScheme }) => {
  if (colorScheme === "brown") return variantSolidBrown()

  if (colorScheme === "ivoire") return variantSolidIvoire()

  return variantSolidAcre()
})

const variantOutline = defineStyle(() => ({
  color: "brown.100",
  borderColor: "brown.20",

  _loading: loadingStyles,
  _disabled: disabledStyles,
  _active: { bg: "brown.30" },
  _hover: {
    bg: "brown.10",
    _disabled: disabledStyles,
  },
}))

const varianLink = defineStyle(() => ({
  fontWeight: "medium",
  color: "brown.100",

  _disabled: {
    color: disabledStyles.color,
  },
  _active: { color: "acre.70" },
  _hover: {
    color: "acre.50",
    textDecoration: "none",
    _disabled: {
      color: disabledStyles.color,
    },
  },
}))

// TODO: Need to update styles for pagination
const variantPagination = defineStyle({
  bg: "white",
  color: "oldPalette.grey.700",
  ring: 0,
  ringInset: "inset",
  ringColor: "white",

  _hover: {
    color: "oldPalette.brand.400",
    bg: "oldPalette.opacity.white.6",
    ring: 1,
  },
  _active: {
    ring: 1,
    ringColor: "oldPalette.brand.400",
  },
  _disabled: {
    color: "oldPalette.grey.300",
    bg: "white",
    opacity: 1,
    pointerEvents: "none",
  },
})

// TODO: Need to update styles for wallet connection component
const variantCard = defineStyle({
  h: 12,
  p: 3,
  pr: 4,
  fontWeight: "semibold",
  bg: "oldPalette.gold.200",
  color: "oldPalette.brand.400",

  _hover: {
    bg: "oldPalette.gold.400",
    textDecoration: "none",
  },
})

const variants = {
  solid: variantSolid,
  outline: variantOutline,
  link: varianLink,
  pagination: variantPagination,
  card: variantCard,
}

const sizeLg = defineStyle({
  py: "1.063rem", // 17px
  px: 6,
  h: 14,
  fontSize: "md",
  lineHeight: "md",
  fontWeight: "semibold",
})

const sizeMd = defineStyle({
  px: 4,
  py: 3,
  h: 12,
  fontSize: "md",
  lineHeight: "md",
  fontWeight: "semibold",
})

const sizeSm = defineStyle({
  px: 4,
  py: 2.5,
  h: 10,
  fontSize: "sm",
  lineHeight: "sm",
  fontWeight: "medium",
})

const sizeXs = defineStyle({
  px: 3,
  py: "0.438rem", // 7px
  h: 8,
  fontSize: "sm",
  lineHeight: "sm",
  fontWeight: "medium",
})

const sizes = {
  lg: sizeLg,
  md: sizeMd,
  sm: sizeSm,
  xs: sizeXs,
}

export default defineStyleConfig({
  defaultProps: {
    colorScheme: "acre",
  },
  baseStyle,
  sizes,
  variants,
})
