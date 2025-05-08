export type ProtocolFee = {
  fee: bigint
  isReimbursable?: boolean
}

export type Fee = {
  tbtc: ProtocolFee
  acre: ProtocolFee
  total: bigint
}
