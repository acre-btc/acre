import React from "react"
import { BoxProps, Box, useMultiStyleConfig } from "@chakra-ui/react"
import { useCountdown } from "#/hooks"
import { TimeUnits } from "#/types"

type CountdownProps = {
  timestamp: number
  addLeadingZeros?: boolean
  units?: (keyof TimeUnits)[]
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  onCountdownEnd?: () => void
} & BoxProps

function Countdown(props: CountdownProps) {
  const {
    timestamp,
    addLeadingZeros = true,
    units = ["hours", "minutes", "seconds"],
    size = "md",
    onCountdownEnd,
    ...restProps
  } = props

  const styles = useMultiStyleConfig("Countdown", { size })

  const timeUnits = useCountdown(timestamp, addLeadingZeros, onCountdownEnd)

  return (
    <Box __css={styles.container} {...restProps}>
      {units.map((unit, index) => (
        <React.Fragment key={unit}>
          <Box __css={styles.unit}>{timeUnits[unit]}</Box>
          {index < units.length - 1 && (
            <Box as="span" __css={styles.separator}>
              :
            </Box>
          )}
        </React.Fragment>
      ))}
    </Box>
  )
}

export default Countdown
