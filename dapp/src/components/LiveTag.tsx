import React from "react"
import { TagProps, Tag, TagLabel, Box } from "@chakra-ui/react"
import { motion } from "framer-motion"

const MotionBox = motion(Box)

export default function LiveTag(props: TagProps) {
  return (
    <Tag
      px={4}
      py={2}
      rounded="lg"
      color="surface.3"
      bg="brown.100"
      variant="solid"
      fontSize="md"
      lineHeight={5}
      fontWeight="bold"
      gap={3}
      {...props}
    >
      <Box as="span" display="block" pos="relative">
        <Box
          as="span"
          display="block"
          rounded="full"
          w={2}
          h={2}
          bg="acre.50"
        />
        <MotionBox
          as="span"
          display="block"
          pos="absolute"
          top={0}
          rounded="full"
          w={2}
          h={2}
          bg="acre.50"
          animate={{ scale: [1, 5.5, 0], opacity: [0.5, 0.1, 0] }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        />
      </Box>
      <TagLabel
        textTransform="uppercase"
        fontStyle="italic"
        overflow="visible"
        fontSize="inherit"
        fontWeight="inherit"
        lineHeight="inherit"
      >
        Live
      </TagLabel>
    </Tag>
  )
}
