import React from "react"
import { List } from "@chakra-ui/react"
import { TOKEN_AMOUNT_FIELD_NAME } from "#/components/shared/TokenAmountForm/TokenAmountFormBase"
import {
  useFormField,
  useMinWithdrawAmount,
  useTransactionDetails,
} from "#/hooks"
import { ACTION_FLOW_TYPES, CurrencyType } from "#/types"
import { currencies } from "#/constants"
import FeesDetailsAmountItem from "#/components/shared/FeesDetails/FeesDetailsAmountItem"
import TransactionDetailsAmountItem from "#/components/shared/TransactionDetails/TransactionDetailsAmountItem"
import FeesTooltip from "../../FeesTooltip"

function UnstakeDetails({ currency }: { currency: CurrencyType }) {
  const { value = 0n } = useFormField<bigint>(TOKEN_AMOUNT_FIELD_NAME)
  const minWithdrawAmount = useMinWithdrawAmount()
  const { transactionFee, estimatedAmount } = useTransactionDetails(
    value >= minWithdrawAmount ? value : 0n,
    ACTION_FLOW_TYPES.UNSTAKE,
  )

  const { total: totalFees, ...restFees } = transactionFee

  return (
    <List spacing={3} mt={10}>
      <FeesDetailsAmountItem
        label="Fees"
        // TODO: Add `Bitcoin Network fee` (funding transaction fee selected by
        // the user) and figure out how to estimate this fee.
        tooltip={<FeesTooltip fees={restFees} />}
        from={{
          currency,
          amount: totalFees,
          desiredDecimals: currencies.DESIRED_DECIMALS_FOR_FEE,
          withRoundUp: true,
        }}
        to={{
          currency: "usd",
        }}
      />
      <TransactionDetailsAmountItem
        label="You will receive"
        from={{
          currency,
          amount: estimatedAmount,
        }}
      />
    </List>
  )
}

export default UnstakeDetails
