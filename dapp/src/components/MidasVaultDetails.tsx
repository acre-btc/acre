import React from "react"
import TbtcIcon from "#/assets/icons/TbtcIcon"
import { externalHref, transparency } from "#/constants"
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
      This vault holds tBTC prior to the deployment to vetted strategies.{" "}
      <Link
        fontWeight="bold"
        textDecoration="underline"
        href={externalHref.MIDAS}
        isExternal
      >
        Midas
      </Link>{" "}
      is the infrastructure provider and reviews all deposits and redemptions
      for accounting, security and additional infrastructure. The tBTC is ready
      to request redeem from the Midas vault at any time with approximately 72
      hour cool down time. If redeeming back to Bitcoin, there is a 0.20% fee
      from the Threshold Network bridge.
    </>
  )
}

function AddressValue({ children }: { children: React.ReactNode }) {
  return (
    <Text
      size="sm"
      as="span"
      color="text.primary"
      fontWeight="semibold"
      marginRight={1}
    >
      {children}
    </Text>
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
    vaultName: "Midas acreBTC (macreBTC) Vault",
    description: <MidasVaultDetailsDescription />,
    icon: TbtcIcon,
    sections: [
      {
        sectionKey: "apy",
        label: "APY",
        tooltip:
          "Annual Percentage Yield (APY) is the annual rate of return earned on an investment.",
        items: [
          { label: "Gross Annual", value: "0%" },
          { label: "Net Annual", value: "0%" },
          { label: "Net Monthly", value: "0%" },
          { label: "Net Weekly", value: "0%" },
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
        label: "Transparency",
        items: [
          {
            label: "Available BTC (tBTC) Liquidity",
            value: (
              <DeBankLink address={transparency.AVAILABLE_LIQUIDITY_BUFFER}>
                <AddressValue>
                  {addressUtils.truncateAddress(
                    transparency.AVAILABLE_LIQUIDITY_BUFFER,
                  )}
                </AddressValue>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </DeBankLink>
            ),
          },
          {
            label: "AcreBTC",
            value: (
              <BlockExplorerLink
                type="token"
                chain="ethereum"
                id={transparency.ACREBTC_TOKEN}
              >
                <AddressValue>
                  {addressUtils.truncateAddress(transparency.ACREBTC_TOKEN)}
                </AddressValue>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </BlockExplorerLink>
            ),
          },
          {
            label: "Withdrawal Queue",
            value: (
              <BlockExplorerLink
                type="address"
                chain="ethereum"
                id={transparency.WITHDRAWAL_QUEUE}
              >
                <AddressValue>
                  {addressUtils.truncateAddress(transparency.WITHDRAWAL_QUEUE)}
                </AddressValue>
                <Icon as={IconArrowUpRight} color="acre.50" boxSize={4} />
              </BlockExplorerLink>
            ),
          },
        ],
      },
      {
        sectionKey: "misc",
        items: [
          {
            label: "Infrastructure Provider",
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
            label: "Lockup",
            value: "None",
          },
          {
            label: "Withdrawal Cooldown Time",
            value: "Approximately 72 hours",
          },
        ],
      },
    ],
  }
}
