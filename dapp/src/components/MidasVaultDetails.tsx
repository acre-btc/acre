import React from "react"
import { externalHref, vaults } from "#/constants"
import { Button, Icon, Link } from "@chakra-ui/react"
import TbtcIcon from "#/assets/icons/TbtcIcon"
import { formatNumberToCompactString } from "#/utils/numbersUtils"
import { IconArrowUpRight } from "@tabler/icons-react"
import { addressUtils } from "#/utils"

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
  tvlCapInUsd: tvlCap,
  vaultTvlInUsd,
}: {
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
          { label: "Deposit Fee", value: "0.10%" },
          {
            label: "Withdrawal Fee",
            value: "0.45% (0.25% protocol fee, 0.20% tBTC bridge fee)",
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
            value: formatNumberToCompactString(tvlCap, {
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
            value: addressUtils.truncateAddress(
              vaults.VAULT_PROVIDERS.tbtc.address,
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
