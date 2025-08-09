import React from "react"
import { useMobileMode } from "#/hooks"
import {
  Box,
  BoxProps,
  Button,
  Flex,
  Icon,
  Link,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { IconChevronDown } from "@tabler/icons-react"
import { AnimatePresence, motion } from "framer-motion"
import { externalHref } from "#/constants"
import AcreAnimatedBadge from "./AcreAnimatedBadge"
import LiveTag from "../shared/LiveTag"

const MotionIcon = motion(Icon)
const MotionBox = motion(Box)

type MobileModeBannerProps = BoxProps & {
  forceOpen?: boolean
}

function MobileModeBanner(props: MobileModeBannerProps) {
  const { forceOpen = false, ...restProps } = props

  const isMobileMode = useMobileMode()

  const { isOpen: isBannerOpen, onToggle: handleBannerOpen } = useDisclosure({
    defaultIsOpen: forceOpen,
  })

  if (!isMobileMode) return null

  return (
    <Box
      order="-1"
      position={isBannerOpen ? "sticky" : "relative"}
      top={0}
      w="full"
      zIndex="mobileBanner"
      maxH="100vh"
      {...restProps}
    >
      <Flex align="center" justify="center" p={4} bg="brown.100">
        <Text
          size="md"
          color="surface.4"
          textAlign="center"
          whiteSpace="break-spaces"
        >
          Acre App is <LiveTag color="acre.50" gap={1} px={1} py={0} /> on
          desktop!
        </Text>

        {!forceOpen && (
          <Button
            onClick={handleBannerOpen}
            variant="unstyled"
            display="flex"
            rightIcon={
              <MotionIcon
                as={IconChevronDown}
                boxSize={5}
                animate={{ rotate: isBannerOpen ? -180 : 0 }}
              />
            }
            iconSpacing={0}
            color="acre.50"
            h="auto"
            ml={2}
          >
            <Text size="md">Info</Text>
          </Button>
        )}
      </Flex>

      <AnimatePresence>
        {(forceOpen || isBannerOpen) && (
          <MotionBox
            initial={forceOpen ? false : { height: 0 }}
            animate={{ height: "100vh" }}
            exit={{ height: 0 }}
            w="full"
            overflow="hidden"
          >
            <Box
              h="full"
              bg="brown.100"
              color="surface.4"
              px={5}
              py={8}
              textAlign="center"
            >
              <AcreAnimatedBadge mx="auto" mb={12} boxSize={44} />

              <Text size="4xl" mb={9} fontWeight="500">
                Acre App live only on desktop for now. We&apos;re working with
                partners to bring it to mobile soon.
              </Text>

              <Text size="xl">
                Stay tuned on{" "}
                <Link
                  textDecoration="underline"
                  href={externalHref.X}
                  isExternal
                >
                  X
                </Link>{" "}
                and join our{" "}
                <Link
                  textDecoration="underline"
                  href={externalHref.DISCORD}
                  isExternal
                >
                  Discord
                </Link>
                . We would love to hear from you.
              </Text>
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  )
}

export default MobileModeBanner
