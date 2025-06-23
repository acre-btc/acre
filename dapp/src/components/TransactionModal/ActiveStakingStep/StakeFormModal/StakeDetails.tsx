import React from "react"
import { List } from "@chakra-ui/react"
import FeesDetailsAmountItem from "#/components/FeesDetails/FeesDetailsAmountItem"
import TransactionDetailsAmountItem from "#/components/TransactionDetails/TransactionDetailsAmountItem"
import { TOKEN_AMOUNT_FIELD_NAME } from "#/components/TokenAmountForm/TokenAmountFormBase"
import {
  useFormField,
  useMinDepositAmount,
  useTransactionDetails,
} from "#/hooks"
import { CurrencyType } from "#/types"
import { currencies } from "#/constants"
import FeesTooltip from "../../FeesTooltip"

function StakeDetails({ currency }: { currency: CurrencyType }) {
  const { value = 0n } = useFormField<bigint | undefined>(
    TOKEN_AMOUNT_FIELD_NAME,
  )
  const minDepositAmount = useMinDepositAmount()
  const amount = value >= minDepositAmount ? value : 0n
  const details = useTransactionDetails(amount)
  const { total, ...restFees } = details.transactionFee

  return (
    <List spacing={3} mt={10}>
      <FeesDetailsAmountItem
        label="Fees"
        // TODO: Add `Bitcoin Network fee` (funding transaction fee selected by
        // the user) and figure out how to estimate this fee.
        tooltip={<FeesTooltip fees={restFees} />}
        from={{
          currency,
          amount: total,
          desiredDecimals: currencies.DESIRED_DECIMALS_FOR_FEE,
          withRoundUp: true,
        }}
        to={{
          currency: "usd",
        }}
      />

      <TransactionDetailsAmountItem
        label="You will deposit"
        from={{
          currency,
          amount: details.estimatedAmount,
        }}
      />
    </List>
  )
}

export default StakeDetails
