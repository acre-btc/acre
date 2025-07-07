import React, { FC } from "react"
import {
  Card,
  CardBody,
  CardHeader,
  CardProps,
  CircularProgress,
  IconProps,
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
import StarknetIcon from "#/assets/icons/StarknetIcon"
import { numbersUtils } from "#/utils"

const { formatNumberToCompactString, getPercentValue } = numbersUtils

type VaultItem = {
  icon: FC<IconProps>
  name: string
  portfolioWeight: number
  apr: number
  tvl: number
  curator: string
}

const MOCK_VAULTS: VaultItem[] = [
  {
    icon: StarknetIcon,
    name: "Starknet Staking",
    portfolioWeight: 1,
    apr: 0.03,
    tvl: 5_000_000,
    curator: "August",
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
            {MOCK_VAULTS.map((vault) => (
              <Tr key={vault.name}>
                <Td>
                  <vault.icon boxSize={6} mr={2} />
                  {vault.name}
                </Td>
                <Td>
                  <CircularProgress
                    size={5}
                    thickness={40}
                    clipPath="circle(50%)"
                    color="green.50"
                    mr={2}
                    value={getPercentValue(vault.portfolioWeight * 100)}
                  />
                  {getPercentValue(vault.portfolioWeight * 100)}%
                </Td>
                <Td>{getPercentValue(vault.apr * 100)}%</Td>
                <Td>{formatNumberToCompactString(vault.tvl)}</Td>
                <Td>{vault.curator}</Td>
              </Tr>
            ))}
          </Tbody>

          <Tfoot>More vaults coming soon</Tfoot>
        </Table>
      </CardBody>
    </Card>
  )
}

export default Vaults
