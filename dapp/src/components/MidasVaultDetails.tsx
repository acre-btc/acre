import React from "react"
import TbtcIcon from "#/assets/icons/TbtcIcon"
import { externalHref, transparency, vaults } from "#/constants"
import { addressUtils } from "#/utils"
import { Button, Icon, Link, Text } from "@chakra-ui/react"
import { IconArrowUpRight } from "@tabler/icons-react"

import {
  formatNumberToCompactString,
  numberToLocaleString,
} from "#/utils/numbersUtils"
import BlockExplorerLink from "./shared/BlockExplorerLink"
import DeBankLink from "./shared/DeBankLink"

export default function MidasVaultDetailsDescription() {
  return (
    <>
      Put your Bitcoin to work with this market-neutral DeFi strategy, designed
      for security and transparency.{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.MIDAS_TEAM}
        isExternal
      >
        Midas
      </Link>{" "}
      provides algorithmic infrastructure and 24/7 portfolio monitoring. Risk
      and strategy management are handled by{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.RE7}
        isExternal
      >
        Re7 Labs
      </Link>
      , the innovation arm of Re7 Capital and creators of the Re7 DeFi Ratings
      framework. Risk parameters for the vault have been reviewed and approved
      by the Acre Security Council, following the{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.ACRE_DEPLOYMENT_POLICY}
        isExternal
      >
        Acre Deployment Policy
      </Link>
      . A protocol fee of 20% on earned rewards will go to the Acre DAO and its
      partners. Deposits and withdrawals are always under your direct control,
      and all deployments, rewards, and redemptions are fully on-chain and
      auditable.
    </>
  )
}

export function getMidasVaultDetails({
  depositFeePercentage,
  withdrawalFeePercentage,
  tvlCapInUsd,
  vaultTvlInUsd,
}: {
  depositFeePercentage?: number
  withdrawalFeePercentage?: number
  tvlCapInUsd: number
  vaultTvlInUsd: number
}) {
  return {
    vaultName: "Market-Neutral Bitcoin DeFi Vault",
    description: <MidasVaultDetailsDescription />,
    icon: TbtcIcon,
    sections: [
      {
        sectionKey: "apr",
        label: "APR",
        tooltip:
          "Annual Percentage Rate (APR) is the annual rate of return earned on an investment.",
        items: [
          { label: "Annual", value: "14% (est.)" },
          { label: "Monthly", value: "1.09% (est.)" },
          { label: "Weekly", value: "0.25% (est.)" },
        ],
      },
      {
        sectionKey: "fees",
        label: "Fees",
        tooltip:
          "Fees are charged to cover the costs of managing and operating the vault.",
        items: [
          {
            label: "Deposit Fee",
            value:
              depositFeePercentage !== undefined
                ? `${numberToLocaleString(depositFeePercentage, 2)}%`
                : "Loading...",
          },
          {
            label: "Withdrawal Fee",
            value: withdrawalFeePercentage
              ? `${numberToLocaleString(withdrawalFeePercentage, 2)}%`
              : "Loading...",
          },
          { label: "Protocol Fee", value: "20% of Earned Rewards" },
        ],
      },
      {
        sectionKey: "tvl",
        label: "Total Value Locked",
        tooltip:
          "Total Value Locked (TVL) is the total amount of assets deposited in the vault.",
        items: [
          {
            label: "Active Bitcoin Earning",
            value: formatNumberToCompactString(vaultTvlInUsd, {
              currency: "USD",
              withAutoCompactFormat: true,
            }),
          },
          {
            label: "TVL Cap",
            value: formatNumberToCompactString(tvlCapInUsd, {
              currency: "USD",
              withAutoCompactFormat: true,
            }),
          },
        ],
      },
      {
        sectionKey: "transparency",
        items: [
          {
            label: "Vault Address",
            value: (
              <BlockExplorerLink
                type="address"
                chain="ethereum"
                id={vaults.VAULT_PROVIDERS.tbtc.address}
              >
                <Text
                  size="sm"
                  as="span"
                  color="text.primary"
                  fontWeight="semibold"
                  marginRight={1}
                >
                  {addressUtils.truncateAddress(
                    vaults.VAULT_PROVIDERS.tbtc.address,
                  )}
                </Text>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </BlockExplorerLink>
            ),
          },
          {
            label: "Assets to be Deployed",
            value: (
              <DeBankLink address={transparency.ASSETS_TO_BE_DEPLOYED}>
                <Text
                  size="sm"
                  as="span"
                  color="text.primary"
                  fontWeight="semibold"
                  marginRight={1}
                >
                  {addressUtils.truncateAddress(
                    transparency.ASSETS_TO_BE_DEPLOYED,
                  )}
                </Text>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </DeBankLink>
            ),
          },
          {
            label: "Onchain Wallets",
            value: (
              <DeBankLink address={transparency.ONCHAIN_WALLETS}>
                <Text
                  size="sm"
                  as="span"
                  color="text.primary"
                  fontWeight="semibold"
                  marginRight={1}
                >
                  {addressUtils.truncateAddress(
                    transparency.ONCHAIN_WALLETS,
                  )}
                </Text>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </DeBankLink>
            ),
          },
          {
            label: "Available Liquidity Buffer",
            value: (
              <DeBankLink address={transparency.AVAILABLE_LIQUIDITY_BUFFER}>
                <Text
                  size="sm"
                  as="span"
                  color="text.primary"
                  fontWeight="semibold"
                  marginRight={1}
                >
                  {addressUtils.truncateAddress(
                    transparency.AVAILABLE_LIQUIDITY_BUFFER,
                  )}
                </Text>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </DeBankLink>
            ),
          },
        ]
      },
      {
        sectionKey: "misc",
        items: [
          {
            label: "Risk Manager",
            value: (
              <Button
                as={Link}
                fontSize="md"
                variant="link"
                rightIcon={<Icon as={IconArrowUpRight} color="acre.50" />}
                href={externalHref.RE7}
                isExternal
              >
                Re7 Labs
              </Button>
            ),
          },
          {
            label: "Vault Infrastructure Provider",
            value: (
              <Button
                as={Link}
                fontSize="md"
                variant="link"
                rightIcon={<Icon as={IconArrowUpRight} color="acre.50" />}
                href={externalHref.MIDAS}
                isExternal
              >
                Midas
              </Button>
            ),
          },
          {
            label: "Deposit Token",
            value: "Bitcoin, tBTC",
          },
          {
            label: "Withdrawal Cool Down Time",
            value: "14 days",
          },
        ],
      },
    ],
  }
}
