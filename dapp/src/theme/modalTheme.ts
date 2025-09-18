import { modalAnatomy as parts } from "@chakra-ui/anatomy"
import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react"

const baseStyleContainer = defineStyle({
  px: { base: 3, sm: 8 },
})

const baseStyleDialog = defineStyle({
  marginTop: {
    base: 12,
    sm: "9.75rem", // 156px
  },
  marginBottom: 8,
  boxShadow: "none",
  borderRadius: "md",
  p: { base: 5, sm: 0 },
  bg: "surface.2",
  border: "none",
})

const baseCloseButton = defineStyle({
  top: { base: 3, sm: -7 },
  right: { base: 3, sm: -7 },
  boxSize: { sm: 7 },
  rounded: { sm: "100%" },
  bg: "oldPalette.opacity.white.5",

  _hover: {
    bg: "oldPalette.opacity.white.5",
  },
})

const baseStyleOverlay = defineStyle({
  bg: "none",
  backdropFilter: "auto",
  backdropBlur: "8px",
})

const baseStyleHeader = defineStyle({
  textAlign: "left",
  fontSize: "xl",
  lineHeight: "xl",
  fontWeight: "bold",
  pt: { sm: 8 },
  px: { sm: 8 },
  pb: 8,
})

const baseStyleBody = defineStyle({
  textAlign: "center",
  color: "text.primary",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  pt: 0,
  px: { base: 0, sm: 8 },
  pb: { base: 0, sm: 8 },
})

const baseStyleFooter = defineStyle({
  flexDirection: "column",
  gap: 6,
  px: { base: 0, sm: 8 },
  pb: { base: 0, sm: 8 },
})

const multiStyleConfig = createMultiStyleConfigHelpers(parts.keys)

const baseStyle = multiStyleConfig.definePartsStyle({
  dialogContainer: baseStyleContainer,
  dialog: baseStyleDialog,
  closeButton: baseCloseButton,
  overlay: baseStyleOverlay,
  header: baseStyleHeader,
  body: baseStyleBody,
  footer: baseStyleFooter,
})

const unstyledVariant = multiStyleConfig.definePartsStyle({
  dialog: { bg: "none", borderWidth: 0 },
  overlay: { bg: "oldPalette.opacity.gold.300.75" },
})

const variants = {
  unstyled: unstyledVariant,
}

const sizeXl = multiStyleConfig.definePartsStyle({
  dialog: { maxW: "52rem" },
})

const sizeLg = multiStyleConfig.definePartsStyle({
  dialog: { maxW: "41.5rem" },
})

const sizeMd = multiStyleConfig.definePartsStyle({
  dialog: { w: "30rem" },
})

const sizeFull = multiStyleConfig.definePartsStyle({
  dialog: { w: "100%", h: "100%" },
})

const sizes = {
  full: sizeFull,
  xl: sizeXl,
  lg: sizeLg,
  md: sizeMd,
}

export default multiStyleConfig.defineMultiStyleConfig({
  baseStyle,
  sizes,
  variants,
})
