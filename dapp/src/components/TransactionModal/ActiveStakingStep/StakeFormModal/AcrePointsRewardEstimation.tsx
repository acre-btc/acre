import React, { useMemo, useState } from "react"
import {
  HStack,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  StackProps,
  Text,
  VStack,
} from "@chakra-ui/react"
import { numbersUtils } from "#/utils"
import { IconChevronDown } from "@tabler/icons-react"
import { TOKEN_AMOUNT_FIELD_NAME } from "#/components/TokenAmountForm/TokenAmountFormBase"
import {
  useFormField,
  useMinDepositAmount,
  useTransactionDetails,
} from "#/hooks"
import { time } from "#/constants"

const ACRE_POINTS_DATA = {
  day: {
    label: "per day",
    multipler: 1,
  },
  week: {
    label: "per week",
    multipler: time.ONE_WEEK_IN_DAYS,
  },
  month: {
    label: "per month",
    multipler: time.ONE_MONTH_IN_DAYS,
  },
}

function AcrePointsRewardEstimation(props: StackProps) {
  const [selectedTierItem, setSelectedTierItem] = useState(
    ACRE_POINTS_DATA.month,
  )

  const tierItems = [
    selectedTierItem,
    ...Object.values(ACRE_POINTS_DATA).filter(
      ({ label, multipler }) =>
        label !== selectedTierItem.label &&
        multipler !== selectedTierItem.multipler,
    ),
  ]

  const { value = 0n } = useFormField<bigint | undefined>(
    TOKEN_AMOUNT_FIELD_NAME,
  )
  const { estimatedAmount } = useTransactionDetails(value)
  const minDepositAmount = useMinDepositAmount()
  const amount = value >= minDepositAmount ? estimatedAmount : 0n

  const baseReward = Number(amount)
  const pointsRate = 10000

  const estimatedReward = useMemo(
    () => Math.floor((selectedTierItem.multipler * baseReward) / pointsRate),
    [baseReward, selectedTierItem],
  )

  return (
    <VStack spacing={2} {...props}>
      <HStack>
        <Text size="md" fontWeight="semibold">
          Acre points you&apos;ll earn
        </Text>

        <Menu gutter={0} matchWidth offset={[0, -32]}>
          {({ isOpen }) => (
            <>
              <MenuButton
                type="button"
                h="auto"
                px={3}
                py={1}
                rounded="sm"
                bg="surface.4"
                _hover={{ bg: "surface.3" }}
              >
                <HStack spacing={1}>
                  <Text size="md">{selectedTierItem.label}</Text>
                  <Icon
                    as={IconChevronDown}
                    boxSize={4}
                    color="acre.50"
                    zIndex={2}
                    rotate={isOpen ? 180 : 0}
                    transform="auto"
                  />
                </HStack>
              </MenuButton>

              <MenuList
                p={0}
                minW={0}
                rounded="sm"
                shadow="none"
                bg="surface.4"
                border="none"
                overflow="hidden"
                motionProps={{
                  variants: {},
                }}
              >
                {tierItems.map((tierItem) => (
                  <MenuItem
                    type="button"
                    px={3}
                    py={1}
                    rounded="sm"
                    bg="surface.4"
                    _active={{ bg: "surface.3" }}
                    _hover={{ bg: "surface.3" }}
                    key={tierItem.label}
                    onClick={() => setSelectedTierItem(tierItem)}
                    fontWeight="semibold"
                    whiteSpace="nowrap"
                  >
                    {tierItem.label}
                  </MenuItem>
                ))}
              </MenuList>
            </>
          )}
        </Menu>
      </HStack>

      <Text size="4xl">
        +{numbersUtils.numberToLocaleString(estimatedReward)} PTS
      </Text>
    </VStack>
  )
}

export default AcrePointsRewardEstimation
