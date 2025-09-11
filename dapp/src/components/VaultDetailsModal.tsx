import React, { ReactNode } from "react"
import {
  Button,
  Flex,
  Icon,
  Link,
  List,
  ListItem,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { vaults } from "#/constants"
import numbersUtils, { formatNumberToCompactString } from "#/utils/numbersUtils"
import { IconArrowUpRight, IconShieldFilled } from "@tabler/icons-react"
import withBaseModal from "./ModalRoot/withBaseModal"
import TooltipIcon from "./shared/TooltipIcon"

type VaultDetails = {
  apr: {
    weeklyAprPercentage?: [number, number]
    monthlyAprPercentage?: [number, number]
    allTimeAprPercentage?: [number, number]
  }
  fees: {
    bridgeFee?: number
    managementFee?: number
    performanceFee?: number
  }
  tvl: {
    activeTvl?: number
    tvlCap?: number
  }
  misc: {
    curator: keyof typeof vaults.VAULT_CURATORS
    vaultAddress: string
    depositToken: string
    withdrawalDelaysLabel?: string
  }
}

export type VaultDetailsModalBaseProps = BaseModalProps & {
  provider: keyof typeof vaults.VAULT_PROVIDERS
  details: VaultDetails
}

type FlattenKeys<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? K | FlattenKeys<T[K]>
    : K
}[keyof T] extends infer U
  ? NonNullable<U>
  : never

type VaultDetailsKeys = Exclude<FlattenKeys<VaultDetails>, "misc">

const detailsLabels: Record<VaultDetailsKeys, string> = {
  apr: "APR",
  fees: "Fees",
  tvl: "TVL",
  weeklyAprPercentage: "Weekly APR",
  monthlyAprPercentage: "Monthly APR",
  allTimeAprPercentage: "All time",
  bridgeFee: "Deposit/Withdrawal",
  managementFee: "Management",
  performanceFee: "Performance",
  activeTvl: "Active TVL",
  tvlCap: "TVL cap",
  curator: "Curated by",
  vaultAddress: "Vault address",
  depositToken: "Deposit token",
  withdrawalDelaysLabel: "Withdrawal delays",
}

const tooltipsContents: Partial<Record<VaultDetailsKeys, string>> = {
  apr: "Annual Percentage Rate (APR) is the annual rate of return earned on an investment.",
  fees: "Fees are charged to cover the costs of managing and operating the vault.",
  tvl: "Total Value Locked (TVL) is the total amount of assets deposited in the vault.",
  curator: "The curator is the entity responsible for managing the vault.",
  vaultAddress:
    "The vault address is the unique identifier for the vault on the blockchain.",
  depositToken:
    "The deposit token is the type of asset that can be deposited into the vault.",
  withdrawalDelaysLabel:
    "Withdrawal delays refer to the time period that must pass before a user can withdraw their funds from the vault.",
}

type VaultDetailsSectionProps = {
  sectionKey?: Extract<VaultDetailsKeys, "apr" | "fees" | "tvl">
  details: Partial<Record<VaultDetailsKeys, ReactNode>>
}

function VaultDetailsSection({
  sectionKey,
  details,
}: VaultDetailsSectionProps) {
  const sectionLabel = sectionKey ? detailsLabels[sectionKey] : null
  const sectionTooltip = sectionKey ? tooltipsContents[sectionKey] : null

  return (
    <Flex flexDir="column" bg="surface.1" gap={2} p={5}>
      <Flex align="center" gap={1}>
        {sectionLabel && (
          <Text textAlign="start" fontWeight="semibold">
            {sectionLabel}
          </Text>
        )}
        {sectionTooltip && (
          <TooltipIcon
            placement="right"
            iconColor="text.tertiary"
            label={sectionTooltip}
          />
        )}
      </Flex>

      <List spacing={1}>
        {Object.entries(details).map(([detailKey, value]) => (
          <ListItem
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            key={detailKey}
          >
            <Flex align="center" gap={1}>
              <Text size="md" color="text.primary">
                {detailsLabels[detailKey as VaultDetailsKeys]}
              </Text>

              {tooltipsContents[detailKey as VaultDetailsKeys] && (
                <TooltipIcon
                  placement="right"
                  iconColor="text.tertiary"
                  label={tooltipsContents[detailKey as VaultDetailsKeys]}
                />
              )}
            </Flex>

            <Text size="md" color="text.primary">
              {value}
            </Text>
          </ListItem>
        ))}
      </List>
    </Flex>
  )
}

export function VaultDetailsModalBase({
  provider,
  details,
}: VaultDetailsModalBaseProps) {
  const { apr, fees, tvl, misc } = details

  const { label, icon, description } = vaults.VAULT_PROVIDERS[provider]

  const formattedApr = Object.entries(apr).reduce(
    (acc, [key, [startValue, endValue]]) => ({
      ...acc,
      [key as keyof typeof apr]: `${numbersUtils.getPercentValue(
        startValue,
        1,
      )} - ${numbersUtils.getPercentValue(endValue, 1)}% (est.)`,
    }),
    {} as Partial<Record<keyof typeof apr, string>>,
  )

  const formattedFees = Object.entries(fees).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key as keyof typeof fees]: `${value}%`,
    }),
    {} as Partial<Record<keyof typeof fees, string>>,
  )

  const formattedTvl = Object.entries(tvl).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key as keyof typeof tvl]: formatNumberToCompactString(value, 2),
    }),
    {} as Partial<Record<keyof typeof tvl, string>>,
  )

  const formattedMisc: Record<keyof typeof misc, ReactNode> = {
    curator: (
      <Button
        as={Link}
        fontSize="md"
        variant="link"
        rightIcon={<Icon as={IconArrowUpRight} color="acre.50" />}
        href={vaults.VAULT_CURATORS[misc.curator].url}
        isExternal
      >
        {vaults.VAULT_CURATORS[misc.curator].label}
      </Button>
    ),
    vaultAddress: vaults.VAULT_PROVIDERS[provider].address,
    depositToken: (
      <Flex align="center" gap={2}>
        {vaults.VAULT_PROVIDERS[provider].depositToken}
        <Icon as={icon} boxSize={5} />
      </Flex>
    ),
    withdrawalDelaysLabel: misc.withdrawalDelaysLabel,
  }

  return (
    <>
      <ModalCloseButton />

      <ModalHeader px={10} pb={5}>
        <Icon as={icon} boxSize={10} mb={4} />
        <Text>{label} Staking Vault</Text>
      </ModalHeader>

      <ModalBody px={10}>
        <Text size="md" textAlign="start" color="text.secondary">
          {description}
        </Text>

        <Flex
          flexDir="column"
          w="full"
          gap={1}
          borderRadius="sm"
          overflow="hidden"
        >
          <VaultDetailsSection sectionKey="apr" details={formattedApr} />

          <VaultDetailsSection sectionKey="fees" details={formattedFees} />

          <VaultDetailsSection sectionKey="tvl" details={formattedTvl} />

          <VaultDetailsSection details={formattedMisc} />
        </Flex>

        <Flex alignSelf="start" gap={1} mt={-1} px={6}>
          <Icon as={IconShieldFilled} color="ink.50" />
          <Text size="xs">Non-custodial. Rewards auto-compound daily.</Text>
        </Flex>
      </ModalBody>
    </>
  )
}

const VaultDetailsModal = withBaseModal(VaultDetailsModalBase, {
  size: "lg",
})
export default VaultDetailsModal
