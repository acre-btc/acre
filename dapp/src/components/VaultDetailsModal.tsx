import React from "react"
import {
  Flex,
  Icon,
  List,
  ListItem,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { vaults } from "#/constants"
import { formatNumberToCompactString } from "#/utils/numbersUtils"
import { IconShieldFilled } from "@tabler/icons-react"
import withBaseModal from "./ModalRoot/withBaseModal"

type VaultDetails = {
  apr: {
    weeklyAprPercentage?: number
    monthlyAprPercentage?: number
    allTimeAprPercentage?: number
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

const detailsLabels: Record<VaultDetailsKeys, string | null> = {
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
type VaultDetailsSectionProps = {
  sectionKey?: Extract<VaultDetailsKeys, "apr" | "fees" | "tvl">
  details: Partial<Record<VaultDetailsKeys, string>>
}

function VaultDetailsSection({
  sectionKey,
  details,
}: VaultDetailsSectionProps) {
  const sectionLabel = sectionKey ? detailsLabels[sectionKey] : null

  return (
    <Flex flexDir="column" bg="surface.1" gap={2} p={5}>
      {sectionLabel && (
        <Text textAlign="start" fontWeight="semibold">
          {sectionLabel}
        </Text>
      )}

      <List spacing={1}>
        {Object.entries(details).map(([detailKey, value]) => (
          <ListItem
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            key={detailKey}
          >
            <Text size="md" color="text.primary">
              {detailsLabels[detailKey as VaultDetailsKeys]}
            </Text>

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
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof apr] = `${value}%`
      }
      return acc
    },
    {} as Partial<Record<keyof typeof apr, string>>,
  )

  const formattedFees = Object.entries(fees).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof fees] = `${value}%`
      }
      return acc
    },
    {} as Partial<Record<keyof typeof fees, string>>,
  )

  const formattedTvl = Object.entries(tvl).reduce(
    (acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof tvl] = formatNumberToCompactString(value, 2)
      }
      return acc
    },
    {} as Partial<Record<keyof typeof tvl, string>>,
  )

  const formattedMisc: Record<keyof typeof misc, string | undefined> = {
    curator: vaults.VAULT_CURATORS[misc.curator].label,
    vaultAddress: vaults.VAULT_PROVIDERS[provider].address,
    depositToken: vaults.VAULT_PROVIDERS[provider].depositToken,
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
