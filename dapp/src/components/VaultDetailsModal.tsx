import React from "react"
import { Icon, ModalBody, ModalHeader, Text } from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { vaults } from "#/constants"
import { formatNumberToCompactString } from "#/utils/numbersUtils"
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
  key?: Extract<VaultDetailsKeys, "apr" | "fees" | "tvl">
  details: Partial<Record<VaultDetailsKeys, string>>
}

function VaultDetailsSection({ key, details }: VaultDetailsSectionProps) {
  const sectionLabel = key ? detailsLabels[key] : null

  return (
    <div>
      {sectionLabel && <p>{sectionLabel}</p>}
      <ul>
        {Object.entries(details).map(([detailKey, value]) => (
          <li key={detailKey}>
            {detailsLabels[detailKey as VaultDetailsKeys]}: {value}
          </li>
        ))}
      </ul>
    </div>
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

  return (
    <>
      <ModalHeader>
        <Icon as={icon} boxSize={6} />
        <Text>{label} Staking Vault</Text>
      </ModalHeader>

      <ModalBody>
        <Text size="md">{description}</Text>

        <div>
          <VaultDetailsSection key="apr" details={formattedApr} />

          <VaultDetailsSection key="fees" details={formattedFees} />

          <VaultDetailsSection key="tvl" details={formattedTvl} />

          <VaultDetailsSection details={misc} />
        </div>

        <Text>Non-custodial. Rewards auto-compound daily.</Text>
      </ModalBody>
    </>
  )
}

const VaultDetailsModal = withBaseModal(VaultDetailsModalBase, {
  closeOnEsc: false,
})
export default VaultDetailsModal
