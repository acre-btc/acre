import { log } from "@graphprotocol/graph-ts"
import { Withdraw } from "../generated/schema"
import { RedeemAndBridgeRequested } from "../generated/WithdrawalQueue/WithdrawalQueue"

// This event is emitted in the same transaction as the `RedemptionRequested`
// event from the `BitcoinRedeemerV2` contract. We need to set the
// requestedAmount` field.
// eslint-disable-next-line import/prefer-default-export
export function handleRedeemAndBridgeRequested(
  event: RedeemAndBridgeRequested,
): void {
  const withdrawId = event.params.requestId.toString()
  const withdraw = Withdraw.load(withdrawId)

  if (!withdraw) {
    log.error("Withdraw entity not found. Withdraw id: {}", [withdrawId])
    return
  }

  withdraw.requestedAmount = event.params.tbtcAmount.plus(
    event.params.exitFeeInTbtc,
  )

  withdraw.save()
}
