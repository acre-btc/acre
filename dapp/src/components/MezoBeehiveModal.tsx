import React from "react"
import {
  ModalBody,
  ModalHeader,
  HStack,
  VStack,
  Icon,
  Card,
  CardBody,
  CardHeader,
  ModalCloseButton,
  Flex,
  Text,
} from "@chakra-ui/react"
import { AcreSignIcon, MatsIcon, MezoSignIcon } from "#/assets/icons"
import { IconChartPieFilled } from "@tabler/icons-react"
import { externalHref } from "#/constants"
import { numbersUtils } from "#/utils"
import { useMats } from "#/hooks"
import withBaseModal from "./ModalRoot/withBaseModal"
import LinkButton from "./shared/LinkButton"

function MezoBeehiveModalBase() {
  const { data } = useMats()

  return (
    <>
      <ModalCloseButton />
      <ModalHeader as={VStack} spacing={2.5} px={8} pt={8} pb={2.5}>
        <Text size="xl" fontWeight="bold">
          Acre & Mezo
        </Text>
        <Flex alignItems="center">
          <AcreSignIcon boxSize={10} rounded="full" />
          <MatsIcon
            mx={-2}
            boxSize="3.75rem" // 60px
            ring={0.5}
            ringColor="surface.2"
            rounded="full"
          />
          <MezoSignIcon boxSize={10} rounded="full" zIndex={-1} />
        </Flex>
      </ModalHeader>

      <ModalBody gap={6} pb={{ base: 0, sm: 8 }} overflowX="hidden">
        <VStack spacing={1}>
          {data && (
            <HStack>
              <Text size="2xl" fontWeight="bold">
                {numbersUtils.numberToLocaleString(data.totalMats)}
              </Text>
              <Text size="lg" fontWeight="bold">
                MATS
              </Text>
            </HStack>
          )}
          <Text size="lg">
            Acre users are automatically part of the Mezo Points program as a
            group.
          </Text>
        </VStack>

        <VStack>
          <Card
            gap={2}
            bg="brown.100"
            color="surface.4"
            align="start"
            textAlign="start"
            position="relative"
            mt={2}
            _before={{
              content: '""',
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              w: 4,
              h: 2,
              bg: "inherit",
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "auto",
              translateX: "-50%",
              translateY: "-100%",
            }}
          >
            <CardHeader as={HStack}>
              <Icon as={IconChartPieFilled} color="acre.50" boxSize={5} />
            </CardHeader>

            <CardBody>
              <Text size="md">
                In the event of a reward distribution, your share is calculated
                by deposit amount and duration, and you can claim it directly
                from Acre.
              </Text>
            </CardBody>
          </Card>

          <Card>
            <CardBody
              as={HStack}
              spacing={6}
              color="text.primary"
              textAlign="start"
            >
              <MezoSignIcon
                boxSize="5.5rem" // 88px
                rounded="sm"
              />
              <VStack align="start">
                <Text size="md">
                  Mezo is the economic layer for Bitcoin with a mission to
                  activate a trillion dollar opportunity.
                </Text>

                <LinkButton href={externalHref.MEZO_INFO} isExternal>
                  More info
                </LinkButton>
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </ModalBody>
    </>
  )
}

const MezoBeehiveModal = withBaseModal(MezoBeehiveModalBase, { size: "lg" })
export default MezoBeehiveModal
