import React from "react"
import TbtcIcon from "#/assets/icons/TbtcIcon"
import { externalHref, vaults } from "#/constants"
import { addressUtils } from "#/utils"
import { Button, Icon, Link, Text } from "@chakra-ui/react"
import { IconArrowUpRight } from "@tabler/icons-react"

import {
  formatNumberToCompactString,
  numberToLocaleString,
} from "#/utils/numbersUtils"
import BlockExplorerLink from "./shared/BlockExplorerLink"

export default function MidasVaultDetailsDescription() {
  return (
    <>
      Put your Bitcoin to work with market-neutral DeFi strategy designed for
      security and transparency.{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.MIDAS_TEAM}
        isExternal
      >
        Midas
      </Link>{" "}
      provides an algorithmic infrastructure and 24/7 portfolio monitoring. Risk
      and strategy management comes from{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.RE7}
        isExternal
      >
        Re7Labs
      </Link>
      , the innovation arm of Re7 Capital, known for their on-chain risk
      curation and DeFi Ratings framework. Risk parameters for the vault have
      been reviewed and approved Acre Security Council and your Bitcoin will be
      deployed according to the{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.ACRE_DEPLOYMENT_POLICY}
        isExternal
      >
        Acre Deployment Policy
      </Link>{" "}
      to the following protocols:{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.AAVE}
        isExternal
      >
        Aave
      </Link>
      ,{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.GIZA}
        isExternal
      >
        Giza
      </Link>
      ,{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.RE7_CAPITAL}
        isExternal
      >
        Re7
      </Link>
      . Protocol Fee of 20% of the earned yield will go to the Acre DAO and its
      partners. Deposits and withdrawals always under your direct control.
      Deployments, rewards and redemptions are fully on-chain and auditable.
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
          { label: "Protocol Fee", value: "20% of Earned Rewards" },
        ],
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
