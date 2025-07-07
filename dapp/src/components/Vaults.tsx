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
import { numbersUtils } from "#/utils"
import { IconArrowUpRight, IconChevronRight } from "@tabler/icons-react"
import { vaults } from "#/constants"

const { formatNumberToCompactString, getPercentValue } = numbersUtils

type VaultItem = {
  provider: keyof typeof vaults.VAULT_PROVIDERS
  portfolioWeight: number
  apr: number
  tvl: number
  curator: keyof typeof vaults.VAULT_CURATORS
}

const MOCK_VAULTS: VaultItem[] = [
  {
    provider: "starknet",
    portfolioWeight: 1,
    apr: 0.03,
    tvl: 5_000_000,
    curator: "august",
  },
]

type VaultProps = Omit<CardProps, "children">

function Vaults(props: VaultProps) {
  return (
    <Card {...props}>
      <CardHeader as={Text} size="md" mb={3}>
        Acre Vaults
      </CardHeader>

      <CardBody as={TableContainer}>
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Portfolio weight</Th>
              <Th>APR</Th>
              <Th>TVL</Th>
              <Th>Curator</Th>
            </Tr>
          </Thead>

          <Tbody>
            {MOCK_VAULTS.map((vault) => {
              const provider = vaults.VAULT_PROVIDERS[vault.provider]
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
                        value={getPercentValue(vault.portfolioWeight * 100)}
                      />
                      {getPercentValue(vault.portfolioWeight * 100)}%
                    </Box>
                  </Td>
                  <Td>{getPercentValue(vault.apr * 100)}%</Td>
                  <Td>{formatNumberToCompactString(vault.tvl)}</Td>
                  <Td>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Button
                        as={Link}
                        variant="link"
                        leftIcon={
                          <Icon as={IconArrowUpRight} color="acre.50" />
                        }
                        href={curator.url}
                        isExternal
                      >
                        {curator.label}
                      </Button>
                      <Icon
                        as={IconChevronRight}
                        boxSize={5}
                        color="brown.40"
                      />
                    </Box>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>

          <Tfoot>
            <Td colSpan={5}>More vaults coming soon</Td>
          </Tfoot>
        </Table>
      </CardBody>
    </Card>
  )
}

export default Vaults
