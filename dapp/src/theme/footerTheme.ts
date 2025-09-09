import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react"

const PARTS = ["container", "wrapper", "logo", "list", "link"]

const containerStyles = defineStyle({
  w: "full",
  pos: "sticky",
  bottom: 0,
  left: 0,
  borderTop: "1px",
  borderColor: "surface.5",
  bgColor: "surface.4",
  zIndex: "footer",
})

const wrapperStyles = defineStyle({
  display: "flex",
  alignItems: "center",
  gap: { base: 4, xl: 10 },
  py: 3,
  px: 10,
  mx: "auto",
})

const logoStyles = defineStyle({
  boxSize: 8,
})

const listStyles = defineStyle({
  display: "flex",
  gap: { base: 2, xl: 5 },
  _last: {
    ml: "auto",
  },
})

const linkStyles = defineStyle({
  display: "flex",
  color: "text.primary",
  fontWeight: "medium",
  fontSize: {
    base: "xs",
    md: "sm",
  },
  m: -2,
  p: 2,
  whiteSpace: "nowrap",
})

const multiStyleConfig = createMultiStyleConfigHelpers(PARTS)

const baseStyle = multiStyleConfig.definePartsStyle({
  container: containerStyles,
  wrapper: wrapperStyles,
  logo: logoStyles,
  list: listStyles,
  link: linkStyles,
})

export default multiStyleConfig.defineMultiStyleConfig({
  baseStyle,
})
