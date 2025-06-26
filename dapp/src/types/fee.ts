export type ProtocolFee = {
  fee: bigint
  isReimbursable?: boolean
}

export type Fees = {
  tbtc: ProtocolFee
  acre: ProtocolFee
  total: bigint
}
