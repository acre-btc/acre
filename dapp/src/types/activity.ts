type CommonActivityData = {
  id: string
  initializedAt: number
  finalizedAt?: number
  amount: bigint
  status: "completed" | "pending"
}

type ConditionalActivityData =
  | {
      type: "deposit"
      txHash: string
    }
  // TODO: rename to withdraw-request
  | {
      type: "withdraw"
      txHash?: string
    }
  | { type: "withdraw-funds"; txHash?: string }

export type ActivityType = ConditionalActivityData["type"]

export type Activity = CommonActivityData & ConditionalActivityData
