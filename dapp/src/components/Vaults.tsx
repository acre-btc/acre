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
  Tfoot,
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
import { useModal, useStatistics } from "#/hooks"
import { MODAL_TYPES } from "#/types"

const { formatNumberToCompactString, getPercentValue } = numbersUtils

type VaultItem = {
  provider: keyof typeof vaults.VAULT_PROVIDERS
  portfolioWeight: number
  apr: number
  tvl: number
  tvlCap: number
  curator: keyof typeof vaults.VAULT_CURATORS
}

type VaultsRootProps = CardProps

function VaultsRoot(props: VaultsRootProps) {
  const { children, ...restProps } = props

  return (
    <Card {...restProps}>
      <CardHeader as={Text} size="md" mb={3}>
        Acre Vaults
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
              <Th>Curator</Th>
            </Tr>
          </Thead>

          {children}
        </Table>
      </CardBody>
    </Card>
  )
}

function Vaults(props: VaultsRootProps) {
  const statistics = useStatistics()
  const { openModal } = useModal()

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
      apr: 0.09,
      tvl: statistics.data.tvl.usdValue,
      tvlCap: statistics.data.tvl.cap,
      curator: "re7",
    },
  ]

  const handleOpenVaultDetails = (vault: VaultItem) => {
    openModal(MODAL_TYPES.VAULT_DETAILS, {
      provider: vault.provider,
      details: {
        apr: {
          weeklyAprPercentage: [0.03, 0.05],
          monthlyAprPercentage: [0.03, 0.05],
          allTimeAprPercentage: [0.03, 0.05],
        },
        fees: {
          // TODO: Replace with actual fees
          bridgeFee: 0,
          managementFee: 0,
          performanceFee: 0,
        },
        tvl: {
          activeTvl: vault.tvl,
          tvlCap: vault.tvlCap,
        },
        misc: {
          curator: vault.curator,
          withdrawalDelaysLabel: "2 - 3 days",
        },
      },
    })
  }

  return (
    <VaultsRoot {...props}>
      <Tbody>
        {vaultsItems.map((vault) => {
          const provider = vaults.VAULT_PROVIDERS[vault.provider]
          const portfolioWeightPercentage = getPercentValue(
            vault.portfolioWeight,
            1,
          )
          const aprPercentage = getPercentValue(vault.apr, 1)
          const formattedTvl = formatNumberToCompactString(vault.tvl, 2)
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
              <Td>{formattedTvl}</Td>
              <Td>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
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
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <IconButton
                    variant="ghost"
                    aria-label="Show vault details"
                    onClick={() => handleOpenVaultDetails(vault)}
                    boxSize={5}
                    icon={
                      <Icon
                        boxSize="full"
                        as={IconChevronRight}
                        color="brown.40"
                      />
                    }
                  />
                </Box>
              </Td>
            </Tr>
          )
        })}
      </Tbody>

      <Tfoot>
        <Tr>
          <Td colSpan={5}>More vaults coming soon</Td>
        </Tr>
      </Tfoot>
    </VaultsRoot>
  )
}

export default Vaults
