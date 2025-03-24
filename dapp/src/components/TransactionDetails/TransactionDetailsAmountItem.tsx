import React, { ComponentProps } from "react"
import { Flex } from "@chakra-ui/react"
import { Optional } from "#/types"
import TransactionDetailsItem, { TransactionDetailsItemProps } from "."
import CurrencyBalanceWithConversion from "../CurrencyBalanceWithConversion"
import CurrencyBalance from "../CurrencyBalance"

type TransactionDetailsAmountItemProps = Optional<
  ComponentProps<typeof CurrencyBalanceWithConversion>,
  "to"
> &
  Pick<TransactionDetailsItemProps, "label">

function TransactionDetailsAmountItem({
  label,
  from,
  to,
}: TransactionDetailsAmountItemProps) {
  const fromProps: TransactionDetailsAmountItemProps["from"] = {
    size: "md",
    ...from,
  }

  const toProps: TransactionDetailsAmountItemProps["to"] = to
    ? { size: "sm", fontWeight: "medium", color: "text.tertiary", ...to }
    : undefined

  return (
    <TransactionDetailsItem label={label} alignItems="start">
      <Flex flexDirection="column" alignItems="end">
        {toProps ? (
          <CurrencyBalanceWithConversion from={fromProps} to={toProps} />
        ) : (
          <CurrencyBalance {...fromProps} />
        )}
      </Flex>
    </TransactionDetailsItem>
  )
}

export default TransactionDetailsAmountItem
