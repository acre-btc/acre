type CommonActivityData = {
  id: string
  initializedAt: number
  finalizedAt?: number
  amount: bigint
  status: "completed" | "pending" | "requested" | "migrated"
}

type ConditionalActivityData =
  | {
      type: "deposit"
      txHash?: string
    }
  | {
      type: "withdraw"
      txHash?: string
    }

export type ActivityType = ConditionalActivityData["type"]

export type Activity = CommonActivityData & ConditionalActivityData
