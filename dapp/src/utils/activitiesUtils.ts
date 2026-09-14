import { time } from "#/constants"
import { Activity, ActivityType, WithdrawalDestination } from "#/types"

const MIN_LIMIT_VALUE_DURATION = BigInt(String(1e7)) // 0.1 BTC
const MAX_LIMIT_VALUE_DURATION = BigInt(String(1e8)) // 1 BTC

// A withdrawal bridged to Bitcoin goes through the tBTC redemption process,
// which takes approximately 5 - 7 hours. We use the average value of 6 hours.
const WITHDRAWAL_DURATION_IN_HOURS = 6

// The redemption runs longer when the Bitcoin network is congested or a
// security check needs a closer look. Copy that quotes a ceiling quotes this.
const WITHDRAWAL_MAX_DURATION_IN_HOURS = 24

// A withdrawal paid out in tBTC has no duration to estimate: `acreBTC.redeem`
// pays out in the very transaction that requests it - no bridge and no queue -
// so there is nothing left to wait for once that transaction is mined.
const TBTC_WITHDRAWAL_ESTIMATE = "Immediate"

const isActivityCompleted = (activity: Activity): boolean =>
  activity.status === "completed"

const isActivityMigrated = (activity: Activity): boolean =>
  activity.status === "migrated"

const getActivityTimestamp = (activity: Activity): number =>
  activity?.finalizedAt ?? activity.initializedAt

const hasPendingDeposits = (activities: Activity[]): boolean =>
  activities.some(
    (activity) => activity.status === "pending" && activity.type === "deposit",
  )

const sortActivitiesByTimestamp = (activities: Activity[]): Activity[] =>
  [...activities].sort(
    (activity1, activity2) =>
      getActivityTimestamp(activity2) - getActivityTimestamp(activity1),
  )

const isWithdrawType = (type: ActivityType) => type === "withdraw"

// The one place a duration becomes text, so the same estimate never reaches
// the user as `6 hours` in one spot and `6h` in another.
const formatDuration = (value: number, unit: "hours" | "minutes"): string =>
  `${value} ${unit}`

// An estimate is marked approximate here rather than by each caller, so a slot
// cannot end up prefixing a `~` to something that is not an estimate.
const formatEstimate = (value: number, unit: "hours" | "minutes"): string =>
  `~${formatDuration(value, unit)}`

/**
 * How long a withdrawal to Bitcoin takes, as a noun phrase that reads inside a
 * sentence. Copy quoting a withdrawal time reads the number from here, so it is
 * stated identically wherever it appears.
 *
 * Only the Bitcoin path has a duration to quote - a tBTC withdrawal settles in
 * the transaction that requests it.
 */
const getWithdrawalDuration = (): string =>
  formatDuration(WITHDRAWAL_DURATION_IN_HOURS, "hours")

/**
 * The ceiling quoted alongside {@link getWithdrawalDuration}. Only the Bitcoin
 * path has one - the tBTC path settles in a single transaction.
 */
const getWithdrawalMaxDuration = (): string =>
  formatDuration(WITHDRAWAL_MAX_DURATION_IN_HOURS, "hours")

/**
 * The Bitcoin withdrawal duration in seconds, for deriving the timestamp such
 * a withdrawal is expected to complete at. Reading it from the same constant
 * keeps a countdown from disagreeing with the estimate printed beside it.
 *
 * Only the Bitcoin path needs this. A tBTC withdrawal completes in the
 * transaction that requests it, so it never sits in a state worth counting
 * down.
 */
const getWithdrawalDurationInSeconds = (): number =>
  WITHDRAWAL_DURATION_IN_HOURS * time.ONE_HOUR_IN_SECONDS

/**
 * What an `Estimated duration` slot displays, ready to render: an approximate
 * duration such as `~6 hours`, or `Immediate` for the tBTC path, which is not
 * an estimate. Use {@link getWithdrawalDuration} for copy that quotes a
 * withdrawal time inside a sentence.
 */
function getEstimatedDuration(
  amount: bigint,
  type: ActivityType,
  withdrawalDestination: WithdrawalDestination["type"] = "bitcoin",
): string {
  // This no longer varies by status: a withdrawal used to wait in the Midas
  // queue for the next NAV update before redemption started, which is what the
  // longer `requested` estimate accounted for. Funds now sit on the acreBTC
  // contract, so neither destination waits on the queue.
  if (isWithdrawType(type)) {
    if (withdrawalDestination === "tbtc") return TBTC_WITHDRAWAL_ESTIMATE

    return formatEstimate(WITHDRAWAL_DURATION_IN_HOURS, "hours")
  }

  // Deposit duration is related to the tBTC minting process, which varies based
  // on the amount of BTC deposited.
  // Each threshold requires a different number of Bitcoin transaction confirmations:
  // <0.1 BTC: 1 Bitcoin block confirmation (~10 minutes),
  // >=0.1 BTC and <1 BTC: 3 Bitcoin block confirmations (~30 minutes),
  // >=1 BTC: 6 Bitcoin block confirmations (~60 minutes).
  // The duration of the transaction minting process depends on the Bitcoin network
  // congestion, and the fee paid by the user.
  //
  // After the required number of Bitcoin block confirmations, the tBTC optimistic
  // minting process starts. The optimistic minting process takes approximately
  // 1 hour to complete.
  // After optimistic minting is completed, the Acre bots will finalize the deposit
  // in no more than 10 minutes.
  //
  // We round the estimated duration up to the nearest hour.
  //
  // For <0.1 BTC estimated duration is around 1 hour 20 minutes.
  if (amount < MIN_LIMIT_VALUE_DURATION) return formatEstimate(2, "hours")
  // For <1 BTC estimated duration is around 1 hours 40 minutes.
  if (amount < MAX_LIMIT_VALUE_DURATION) return formatEstimate(2, "hours")
  // For >=1 BTC estimated duration is around 2 hours 10 minutes.
  return formatEstimate(3, "hours")
}

export default {
  isActivityCompleted,
  isActivityMigrated,
  getActivityTimestamp,
  hasPendingDeposits,
  sortActivitiesByTimestamp,
  isWithdrawType,
  getEstimatedDuration,
  getWithdrawalDuration,
  getWithdrawalMaxDuration,
  getWithdrawalDurationInSeconds,
}
