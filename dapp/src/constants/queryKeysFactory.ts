const userKeys = {
  all: ["user"] as const,
  balance: () => [...userKeys.all, "balance"] as const,
  position: () => [...userKeys.all, "position"] as const,
  activities: () => [...userKeys.all, "activities"] as const,
  pointsData: () => [...userKeys.all, "points-data"] as const,
  estimateFee: () => [...userKeys.all, "estimateFee"] as const,
  registerAcreToken: () => [
    ...userKeys.all,
    "registerAcreEthereumAddressInLedgerLive",
  ],
}

const acreKeys = {
  all: ["acre"] as const,
  totalAssets: () => [...acreKeys.all, "total-assets"] as const,
  statistics: () => [...acreKeys.all, "statistics"] as const,
  mats: () => [...acreKeys.all, "mats"] as const,
  pointsData: () => [...acreKeys.all, "points-data"] as const,
}

export default {
  userKeys,
  acreKeys,
}
