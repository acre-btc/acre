import React from "react"
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardProps,
  Icon,
  Link,
  Tag,
  TagLeftIcon,
  VStack,
  Text,
} from "@chakra-ui/react"
import { acrePointsCardPlaceholder } from "#/assets/images"
import UserDataSkeleton from "#/components/UserDataSkeleton"
import {
  IconArrowUpRight,
  IconPlayerTrackNextFilled,
} from "@tabler/icons-react"
import { externalHref } from "#/constants"

export default function AcrePointsTemplateCard(props: CardProps) {
  return (
    <Card
      px="1.875rem" // 30px
      {...props}
    >
      <CardHeader mb={8}>
        <Text size="md">Acre points</Text>
      </CardHeader>

      <CardBody>
        <UserDataSkeleton>
          <VStack
            bgImg={acrePointsCardPlaceholder}
            bgSize="cover"
            spacing={0}
            pt={16}
            pb="8.5rem" // 136px (156px - y-axis padding)
          >
            <Tag
              px={3}
              py={1}
              bg="brown.100"
              color="surface.4"
              mb={6}
              border={0}
            >
              <TagLeftIcon
                as={IconPlayerTrackNextFilled}
                color="oldPalette.brand.300"
              />
              <Text
                size="sm"
                textTransform="uppercase"
                fontWeight="bold"
                fontStyle="italic"
              >
                Coming soon
              </Text>
            </Tag>
            <Text size="lg" color="text.primary" fontWeight="semibold">
              Acre Points will be live soon!
            </Text>
            <Text size="md" color="text.tertiary" fontWeight="medium">
              Stake now to secure your spot
            </Text>
            {/* TODO: Update `ButtonLink` component and 'link' Button theme variant */}
            <Button
              as={Link}
              href={`${externalHref.DOCS}/acre-points-program`}
              isExternal
              variant="ghost"
              color="acre.50"
              iconSpacing={1}
              rightIcon={
                <Icon as={IconArrowUpRight} boxSize={4} color="acre.50" />
              }
              mt={4}
            >
              Read documentation
            </Button>
          </VStack>
        </UserDataSkeleton>
      </CardBody>
    </Card>
  )
}
