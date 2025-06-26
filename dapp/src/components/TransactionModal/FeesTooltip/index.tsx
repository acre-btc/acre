import React from "react"
import { List } from "@chakra-ui/react"
import TooltipIcon from "#/components/shared/TooltipIcon"
import { Fees as AcreFee } from "#/types"
import FeesTooltipItem from "./FeesTooltipItem"

type Props = {
  fees: Omit<AcreFee, "total">
}

const mapFeeToLabel = (feeId: keyof AcreFee) => {
  switch (feeId) {
    case "acre":
      return "Protocol fee"
    case "tbtc":
      return "tBTC Bridge fee"
    default:
      return ""
  }
}

const mapFeeToReimbursableFeeLabel = (feeId: keyof AcreFee) => {
  switch (feeId) {
    case "tbtc":
      return "*tBTC Bridge fee covered by Acre"
    case "acre":
    default:
      return ""
  }
}

export default function FeesTooltip({ fees }: Props) {
  return (
    <TooltipIcon
      placement="right"
      label={
        <List spacing={2} minW={60}>
          {Object.entries(fees).map(([feeKey, { fee, isReimbursable }]) => (
            <FeesTooltipItem
              key={feeKey}
              label={mapFeeToLabel(feeKey as keyof AcreFee)}
              amount={fee}
              isReimbursable={isReimbursable}
              reimbursableFeeLabel={mapFeeToReimbursableFeeLabel(
                feeKey as keyof AcreFee,
              )}
              currency="bitcoin"
            />
          ))}
        </List>
      }
    />
  )
}
