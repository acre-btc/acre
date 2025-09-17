import { env } from "#/constants"
import axiosStatic from "axios"

const axios = axiosStatic.create({
  baseURL: env.ACRE_API_ENDPOINT,
  withCredentials: true,
})

async function getSession() {
  const response = await axios.get<{ nonce: string } | { address: string }>(
    "session",
  )

  return response.data
}

async function createSession(
  message: string,
  signature: string,
  publicKey: string,
) {
  const response = await axios.post<{ success: boolean }>("session", {
    message,
    signature,
    publicKey,
  })

  if (!response.data.success) {
    throw new Error("Failed to create Acre session")
  }
}

async function deleteSession() {
  await axios.delete("session")
}

type PointsDataResponse = {
  dropAt: number
  isCalculationInProgress: boolean
  totalPool: string
}

const getPointsData = async () => {
  const url = "points"
  const response = await axios.get<PointsDataResponse>(url)

  return {
    nextDropTimestamp: response.data.dropAt,
    isCalculationInProgress: response.data.isCalculationInProgress,
    totalPoolBalance: Number(response.data.totalPool),
  }
}

type PointsDataByUserResponse = {
  isEligible: boolean
  claimed: string
  unclaimed: string
}

const getPointsDataByUser = async (address: string) => {
  const url = `users/${address}/points`
  const response = await axios.get<PointsDataByUserResponse>(url)

  return {
    totalBalance: Number(response.data.claimed),
    claimableBalance: Number(response.data.unclaimed),
    isEligible: response.data.isEligible,
  }
}

type ClaimAcrePointsResponse = {
  claimed: string
  total: string
  claimedAt: number
}
const claimPoints = async (address: string) => {
  const url = `users/${address}/points/claim`
  const response = await axios.post<ClaimAcrePointsResponse>(url)

  return {
    claimed: BigInt(response.data.claimed),
    total: BigInt(response.data.total),
    claimedAt: response.data.claimedAt,
  }
}

const verifyAccessCode = async (encodedCode: string): Promise<boolean> => {
  const response = await axios.post<{ isValid: boolean }>("access/verify", {
    encodedCode,
  })

  return response.data.isValid
}

async function getBtcUsdPrice(): Promise<number> {
  const response = await axios.get<{ btcUsdPrice: number }>("currency/btc")
  return response.data.btcUsdPrice
}

type GetStatisticsResponse = {
  tvl: {
    usd: number
    btc: number
    cap: number
  }
}

async function getStatistics() {
  const response = await axios.get<GetStatisticsResponse>("statistics")
  return response.data.tvl
}

export default {
  createSession,
  getSession,
  deleteSession,
  getPointsData,
  getPointsDataByUser,
  claimPoints,
  verifyAccessCode,
  getBtcUsdPrice,
  getStatistics,
}
