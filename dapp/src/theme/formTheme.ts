import { formAnatomy as parts } from "@chakra-ui/anatomy"
import { createMultiStyleConfigHelpers, defineStyle } from "@chakra-ui/react"

const baseStyleHelperText = defineStyle({
  display: "flex",
  // `ModalBody` centres its text, which reads badly on a wrapped hint.
  textAlign: "left",
  // `center` floats the icon between the lines once the text wraps, so pin it
  // to the first line and nudge it back to optically centred there.
  alignItems: "flex-start",
  // Mirrors the checkbox control size and label spacing, so a hint under a
  // checkbox lines up with it in both the icon and the text column.
  gap: 2,
  fontWeight: "medium",
  color: "text.tertiary",

  svg: {
    boxSize: 4,
    flexShrink: 0,
    mt: "2px",
  },
})

const multiStyleConfig = createMultiStyleConfigHelpers(parts.keys)

const baseStyle = multiStyleConfig.definePartsStyle({
  helperText: baseStyleHelperText,
})

export default multiStyleConfig.defineMultiStyleConfig({ baseStyle })
