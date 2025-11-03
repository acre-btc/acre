import React, { ReactNode } from "react"
import {
  ComponentWithAs,
  Flex,
  Icon,
  IconProps,
  List,
  ListItem,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { IconShieldFilled } from "@tabler/icons-react"
import { vaults } from "#/constants"
import withBaseModal from "./ModalRoot/withBaseModal"
import TooltipIcon from "./shared/TooltipIcon"
import { getMidasVaultDetails } from "./MidasVaultDetails"

export type VaultDetailsSectionItem = {
  key?: string
  label: ReactNode
  value: ReactNode
  tooltipContent?: ReactNode
}

type VaultDetailsLabeledSection = {
  sectionKey: string
  label?: ReactNode
  tooltip?: ReactNode
  items: VaultDetailsSectionItem[]
}

export type VaultDetails = {
  vaultName: ReactNode
  description: ReactNode
  icon: ComponentWithAs<"svg", IconProps>
  sections: Array<VaultDetailsLabeledSection>
}

type VaultParamDetails = {
  depositFeePercentage?: number
  withdrawalFeePercentage?: number
  tvlCapInUsd: number
  vaultTvlInUsd: number
}

export type VaultDetailsModalBaseProps = BaseModalProps & {
  provider: keyof typeof vaults.VAULT_PROVIDERS
} & VaultParamDetails

function VaultDetailsSection({
  label,
  tooltip,
  items,
}: Omit<VaultDetailsLabeledSection, "sectionKey">) {
  return (
    <Flex flexDir="column" bg="surface.1" gap={2} p={5}>
      <Flex align="center" gap={1}>
        {label && (
          <Text textAlign="start" fontWeight="semibold">
            {label}
          </Text>
        )}
        {tooltip && (
          <TooltipIcon
            placement="right"
            iconColor="text.tertiary"
            label={tooltip}
          />
        )}
      </Flex>

      <List spacing={1}>
        {items.map(({ key, label: itemLabel, value, tooltipContent }) => (
          <ListItem
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            key={typeof itemLabel === "string" ? itemLabel : key}
          >
            <Flex align="center" gap={1}>
              {typeof itemLabel === "string" ? (
                <Text size="md" color="text.primary">
                  {itemLabel}
                </Text>
              ) : (
                itemLabel
              )}

              {tooltipContent && (
                <TooltipIcon
                  placement="right"
                  iconColor="text.tertiary"
                  label={tooltipContent}
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

const VAULT_PROVIDER_TO_DETAILS: Record<
  VaultDetailsModalBaseProps["provider"],
  (options: VaultParamDetails) => VaultDetails
> = {
  tbtc: getMidasVaultDetails,
}

export function VaultDetailsModalBase({
  provider,
  depositFeePercentage,
  withdrawalFeePercentage,
  tvlCapInUsd,
  vaultTvlInUsd,
}: VaultDetailsModalBaseProps) {
  const details = VAULT_PROVIDER_TO_DETAILS[provider]({
    depositFeePercentage,
    withdrawalFeePercentage,
    tvlCapInUsd,
    vaultTvlInUsd,
  })

  return (
    <>
      <ModalCloseButton />

      <ModalHeader px={10} pb={5}>
        <Icon as={details.icon} boxSize={10} mb={4} />
        <Text>{details.vaultName}</Text>
      </ModalHeader>

      <ModalBody px={10}>
        <Text size="md" textAlign="start" color="text.secondary">
          {details.description}
        </Text>

        <Flex
          flexDir="column"
          w="full"
          gap={1}
          borderRadius="sm"
          overflow="hidden"
        >
          {details.sections.map((section) => (
            <VaultDetailsSection
              key={section.sectionKey}
              label={section.label}
              items={section.items}
              tooltip={section.tooltip}
            />
          ))}
        </Flex>

        <Flex alignSelf="start" gap={1} mt={-1} px={6}>
          <Icon as={IconShieldFilled} color="ink.50" />
          <Text size="xs">
            No centralized custodian. All on-chain. Rewards auto-compound to
            Bitcoin daily.
          </Text>
        </Flex>
      </ModalBody>
    </>
  )
}

const VaultDetailsModal = withBaseModal(VaultDetailsModalBase, {
  size: "lg",
})
export default VaultDetailsModal
