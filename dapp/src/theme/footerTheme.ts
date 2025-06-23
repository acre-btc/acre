import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react"

const PARTS = ["container", "wrapper", "logo", "list"]

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
  maxW: "120rem", // 1920px
  py: 3,
  px: { base: 4, md: "2.5rem", xl: 30 },
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

const multiStyleConfig = createMultiStyleConfigHelpers(PARTS)

const baseStyle = multiStyleConfig.definePartsStyle({
  container: containerStyles,
  wrapper: wrapperStyles,
  logo: logoStyles,
  list: listStyles,
})

export default multiStyleConfig.defineMultiStyleConfig({
  baseStyle,
})
