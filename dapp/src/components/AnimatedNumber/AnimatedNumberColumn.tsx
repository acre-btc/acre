import React, { useCallback, useEffect, useRef, useState } from "react"
import { Box, BoxProps, useToken } from "@chakra-ui/react"
import { motion } from "framer-motion"

const MotionBox = motion(Box)

type AnimatedNumberColumnProps = BoxProps & {
  digit: string
  animateWhileInView?: boolean
  indicationColor?: string
}

function AnimatedNumberColumn(props: AnimatedNumberColumnProps) {
  const {
    digit,
    animateWhileInView = false,
    indicationColor,
    ...restProps
  } = props

  const [position, setPosition] = useState(0)
  const [isUpdateIndicated, setIsUpdateIndicated] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)

  const setDigitToPosition = useCallback((columnDigit: string) => {
    setPosition((containerRef.current?.clientHeight ?? 0) * +columnDigit)
  }, [])

  useEffect(() => setDigitToPosition(digit), [digit, setDigitToPosition])

  const indicationColorValue = useToken("colors", indicationColor ?? "acre.50")

  return (
    <Box ref={containerRef} position="relative" {...restProps}>
      <MotionBox
        key={digit}
        animate={
          animateWhileInView
            ? undefined
            : {
                y: position,
                color:
                  indicationColor && isUpdateIndicated
                    ? indicationColorValue
                    : undefined,
              }
        }
        whileInView={
          animateWhileInView
            ? {
                y: position,
                color:
                  indicationColor && isUpdateIndicated
                    ? indicationColorValue
                    : undefined,
              }
            : undefined
        }
        initial={false}
        transition={{ type: "spring", damping: 12, stiffness: 84 }}
        position="absolute"
        bottom={0}
        h="1000%"
        onAnimationComplete={() => setIsUpdateIndicated(false)}
      >
        {[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((columnDigit) => (
          <Box key={columnDigit} h="10%">
            <Box as="span">{columnDigit}</Box>
          </Box>
        ))}
      </MotionBox>

      <Box as="span" visibility="hidden">
        0
      </Box>
    </Box>
  )
}

export default AnimatedNumberColumn
