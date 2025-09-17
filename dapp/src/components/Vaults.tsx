import React from "react"
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardProps,
  CircularProgress,
  Icon,
  IconButton,
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react"
import { logPromiseFailure, numbersUtils } from "#/utils"
import {
  IconArrowUpRight,
  IconChevronRight,
  IconExclamationCircle,
  IconRefresh,
} from "@tabler/icons-react"
import { vaults } from "#/constants"
import { useCurrencyConversion, useModal, useStatistics } from "#/hooks"
import { MODAL_TYPES } from "#/types"
import { getMidasVaultDetails } from "./MidasVaultDetails"
import { VaultDetails } from "./VaultDetailsModal"

const { formatNumberToCompactString, getPercentValue } = numbersUtils

type VaultItem = {
  provider: keyof typeof vaults.VAULT_PROVIDERS
  portfolioWeight: number
  apr: number
  tvl: number
  tvlCap: number
  curator: keyof typeof vaults.VAULT_CURATORS
  details: VaultDetails
}

type VaultsRootProps = CardProps

function VaultsRoot(props: VaultsRootProps) {
  const { children, ...restProps } = props

  return (
    <Card {...restProps}>
      <CardHeader as={Text} size="md" mb={3}>
        Acre Bitcoin Vault
      </CardHeader>

      <CardBody as={TableContainer}>
        <Table>
          <colgroup>
            <col style={{ width: "35%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "12.5%" }} />
            <col style={{ width: "12.5%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>

          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Portfolio weight</Th>
              <Th>APR</Th>
              <Th>TVL</Th>
              <Th>Risk Manager</Th>
            </Tr>
          </Thead>

          {children}
        </Table>
      </CardBody>
    </Card>
  )
}

function VaultTableRow({ vault }: { vault: VaultItem }) {
  const { openModal } = useModal()

  const provider = vaults.VAULT_PROVIDERS[vault.provider]
  const portfolioWeightPercentage = getPercentValue(vault.portfolioWeight, 1)
  const aprPercentage = getPercentValue(vault.apr, 100)
  const tvlCapAsSatoshi = numbersUtils.userAmountToBigInt(
    // The TVL cap is in Bitcoin, and to convert it to USD, we first need to
    // convert it to Satoshis because of how our `useCurrencyConversion` hook
    // works.
    vault.tvlCap.toString(),
    8,
  )

  const tvlCapInUsd = useCurrencyConversion({
    from: {
      currency: "bitcoin",
      amount: tvlCapAsSatoshi,
    },
    to: { currency: "usd" },
  })

  const handleOpenVaultDetails = () => {
    openModal(MODAL_TYPES.VAULT_DETAILS, {
      provider: vault.provider,
      tvlCapInUsd,
      vaultTvlInUsd: vault.tvl,
    })
  }
  const formattedTvlCap = formatNumberToCompactString(tvlCapInUsd ?? 0, {
    currency: "USD",
    withAutoCompactFormat: true,
  })
  const formattedTvl = formatNumberToCompactString(vault.tvl, {
    currency: "USD",
    withAutoCompactFormat: true,
  })
  const curator = vaults.VAULT_CURATORS[vault.curator]

  return (
    <Tr key={vault.portfolioWeight}>
      <Td>
        <Box display="flex" gap={2} alignItems="center">
          <Icon as={provider.icon} boxSize={6} />
          {provider.label}
        </Box>
      </Td>
      <Td>
        <Box display="flex" gap={2} alignItems="center">
          <CircularProgress
            size={5}
            thickness={40}
            clipPath="circle(50%)"
            color="green.50"
            value={portfolioWeightPercentage}
          />
          {portfolioWeightPercentage}%
        </Box>
      </Td>
      <Td>{aprPercentage}% (est.)</Td>
      <Td letterSpacing="-0.5px">
        <Box as="span" fontWeight="bold">
          {formattedTvl}
        </Box>{" "}
        / {formattedTvlCap}
      </Td>
      <Td>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Button
            as={Link}
            variant="link"
            leftIcon={<Icon as={IconArrowUpRight} color="acre.50" />}
            href={curator.url}
            isExternal
          >
            {curator.label}
          </Button>
        </Box>
      </Td>
      <Td>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <IconButton
            variant="ghost"
            aria-label="Show vault details"
            onClick={handleOpenVaultDetails}
            boxSize={5}
            icon={
              <Icon boxSize="full" as={IconChevronRight} color="brown.40" />
            }
          />
        </Box>
      </Td>
    </Tr>
  )
}

function Vaults(props: VaultsRootProps) {
  const statistics = useStatistics()

  const handleRefetch = () => logPromiseFailure(statistics.refetch())

  if (statistics.isPending) {
    return (
      <VaultsRoot {...props}>
        <Tbody>
          <Tr>
            <Td colSpan={5}>
              <Box display="flex" alignItems="center" gap={3}>
                <CircularProgress isIndeterminate color="acre.50" size={5} />
                <Text>Loading...</Text>
              </Box>
            </Td>
          </Tr>
        </Tbody>
      </VaultsRoot>
    )
  }

  if (statistics.isError) {
    return (
      <VaultsRoot {...props}>
        <Tbody>
          <Tr>
            <Td colSpan={5}>
              <Box display="flex" alignItems="center" gap={3} color="red.500">
                <Icon as={IconExclamationCircle} boxSize={5} />
                <Text>Error loading vaults</Text>
                <Button
                  onClick={handleRefetch}
                  size="sm"
                  variant="ghost"
                  ml="auto"
                  h="auto"
                  leftIcon={<Icon as={IconRefresh} boxSize={4} />}
                >
                  Try again
                </Button>
              </Box>
            </Td>
          </Tr>
        </Tbody>
      </VaultsRoot>
    )
  }

  const vaultsItems: VaultItem[] = [
    {
      provider: "tbtc",
      portfolioWeight: 1,
      apr: 14,
      tvl: statistics.data.tvl.usdValue,
      tvlCap: statistics.data.tvl.cap,
      curator: "re7",
      details: getMidasVaultDetails({
        tvlCapInUsd: statistics.data.tvl.cap,
        vaultTvlInUsd: statistics.data.tvl.usdValue,
      }),
    },
  ]

  return (
    <VaultsRoot {...props}>
      <Tbody>
        {vaultsItems.map((vault) => (
          <VaultTableRow key={vault.portfolioWeight} vault={vault} />
        ))}
      </Tbody>
    </VaultsRoot>
  )
}

export default Vaults
