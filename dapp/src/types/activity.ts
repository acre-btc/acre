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
      // The chain the `txHash` belongs to depends on the destination: a Bitcoin
      // withdrawal links to the redemption transaction on Bitcoin, a tBTC one
      // to the Ethereum transaction that requested it.
      txHash?: string
      destination: "bitcoin" | "ethereum"
    }

export type ActivityType = ConditionalActivityData["type"]

export type Activity = CommonActivityData & ConditionalActivityData
