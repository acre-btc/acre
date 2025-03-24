import React from "react"
import { MezoSignIcon } from "#/assets/icons"
import { beehiveIllustration } from "#/assets/images"
import TooltipIcon from "#/components/TooltipIcon"
import UserDataSkeleton from "#/components/UserDataSkeleton"
import { useMats, useModal } from "#/hooks"
import { MODAL_TYPES } from "#/types"
import { numbersUtils } from "#/utils"
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardProps,
  Flex,
  Highlight,
  Image,
  VStack,
  Text,
} from "@chakra-ui/react"

export default function BeehiveCard(props: CardProps) {
  const { openModal } = useModal()
  const { data } = useMats()

  const handleOpenBeehiveModal = () => {
    openModal(MODAL_TYPES.MEZO_BEEHIVE)
  }

  return (
    <Card {...props}>
      <CardHeader as={Flex} alignItems="center" justify="space-between" gap={2}>
        <Text size="md">Additional rewards</Text>
        <TooltipIcon
          label="Acre Beehive automatically collects rewards from our partner projects. Rewards are dropped daily, and your share is calculated based on your deposit amount and how long you HODL."
          w={56}
        />
      </CardHeader>

      <CardBody as={VStack}>
        <Image src={beehiveIllustration} boxSize={32} />
        <UserDataSkeleton w="100%" mt={-7}>
          <Box px={4} py={3} bg="surface.2" borderRadius="sm">
            <Text size="sm">
              <Highlight query="Mezo" styles={{ color: "mezo" }}>
                Total collected mats from Mezo
              </Highlight>
              <MezoSignIcon
                ml={1}
                boxSize={{ base: 4, md: 5 }}
                rounded="full"
              />
            </Text>
            {data && (
              <Text size="2xl" fontWeight="semibold" color="text.primary">
                {numbersUtils.numberToLocaleString(data.totalMats)}
              </Text>
            )}
            <Button mt={4} variant="outline" onClick={handleOpenBeehiveModal}>
              Read more
            </Button>
          </Box>
        </UserDataSkeleton>
      </CardBody>
    </Card>
  )
}
