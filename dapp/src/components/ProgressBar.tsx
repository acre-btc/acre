import React from "react"
import { Progress, ProgressProps, ProgressLabel, Icon } from "@chakra-ui/react"
import { IconBolt } from "@tabler/icons-react"

type ProgressBarProps = ProgressProps & {
  withBoltIcon?: boolean
}

function ProgressBar(props: ProgressBarProps) {
  const { value = 0, children, withBoltIcon = false, ...restProps } = props

  return (
    <Progress value={value} hasStripe {...restProps}>
      <ProgressLabel>{children}</ProgressLabel>

      {withBoltIcon && (
        <Icon
          position="absolute"
          top="50%"
          left={`${value}%`}
          color="text.primary"
          boxSize={3}
          transform="auto"
          translateX="-100%"
          translateY="-50%"
          as={IconBolt}
          fill="currentcolor"
          mx={-1}
        />
      )}
    </Progress>
  )
}

export default ProgressBar
