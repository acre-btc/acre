import React, { useMemo } from "react"
import { FlexProps, Flex, Box } from "@chakra-ui/react"
import { motion } from "framer-motion"
import AnimatedNumberSeparator from "./AnimatedNumberSeparator"
import AnimatedNumberColumn from "./AnimatedNumberColumn"

const MotionFlex = motion(Flex)

const isSeparatorSegment = (value: string): value is "." | "," =>
  [",", "."].includes(value)

type AnimatedNumberProps = FlexProps & {
  value: number | string
  desiredDecimals?: number
  prefix?: string
  suffix?: string
  animateMode?: "whileInView" | "always"
  indicationColor?: string
}

function AnimatedNumber(props: AnimatedNumberProps) {
  const {
    value,
    desiredDecimals = 0,
    prefix = "",
    suffix = "",
    animateMode = "whileInView",
    indicationColor,
    ...restProps
  } = props
  const numberSegments = useMemo(() => {
    const parsedValue =
      typeof value === "string"
        ? value
        : Math.max(value, 0).toFixed(desiredDecimals)

    return parsedValue.split("").reverse()
  }, [value, desiredDecimals])

  return (
    <MotionFlex
      flexFlow="row-reverse"
      justify="center"
      position="relative"
      overflow="hidden"
      m="auto"
      h="full"
      whiteSpace="pre"
      {...restProps}
    >
      {suffix && <Box as="span">{suffix}</Box>}

      {numberSegments.map((segment, index) => {
        const key = `${segment}-${index}`
        return (
          <React.Fragment key={key}>
            {isSeparatorSegment(segment) ? (
              <AnimatedNumberSeparator>{segment}</AnimatedNumberSeparator>
            ) : (
              <AnimatedNumberColumn
                digit={segment}
                animateWhileInView={animateMode === "whileInView"}
                indicationColor={indicationColor}
              />
            )}
          </React.Fragment>
        )
      })}

      {prefix && <Box as="span">{prefix}</Box>}
    </MotionFlex>
  )
}

export default AnimatedNumber
