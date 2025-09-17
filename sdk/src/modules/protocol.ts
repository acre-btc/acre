import { AcreContracts } from "../lib/contracts"
import { fromSatoshi, toSatoshi } from "../lib/utils"

export type ProtocolFee = {
  fee: bigint
  isReimbursable: boolean
}

/**
 * Represents all total deposit fees grouped by network.
 */
export type Fees = {
  acre: ProtocolFee
  total: bigint
}

/**
 * Represents all total withdrawal fees grouped by network.
 */
export type WithdrawalFees = Fees & { tbtc: ProtocolFee }

function sumFees(fees: { [key: string]: bigint }): bigint {
  return Object.values(fees).reduce((reducer, fee) => reducer + fee, 0n)
}

/**
 * Module exposing general functions related to the Acre protocol.
 */
export default class Protocol {
  /**
   * Acre contracts.
   */
  readonly #contracts: AcreContracts

  constructor(contracts: AcreContracts) {
    this.#contracts = contracts
  }

  /**
   * @returns Total Bitcoin amount under protocol management in 1e8 satoshi
   *          precision.
   */
  async totalAssets() {
    return toSatoshi(await this.#contracts.acreBTC.totalAssets())
  }

  /**
   * Estimates the deposit fee based on the provided amount.
   * @param amount Amount to deposit in satoshi.
   * @returns Deposit fee grouped by protocols in 1e8 satoshi precision and
   *          total deposit fee value.
   */
  async estimateDepositFee(amount: bigint): Promise<Fees> {
    const amountInTokenPrecision = fromSatoshi(amount)

    const { acre: acreFees } =
      await this.#contracts.bitcoinDepositor.calculateDepositFee(
        amountInTokenPrecision,
      )
    const depositFee = await this.#contracts.acreBTC.calculateDepositFee(
      amountInTokenPrecision,
    )

    const acre = toSatoshi(sumFees(acreFees)) + toSatoshi(depositFee)

    return {
      acre: {
        fee: acre,
        isReimbursable: false,
      },
      total: acre,
    }
  }

  /**
   * Estimates the withdrawal fee based on the provided amount.
   * @param amount Amount to withdraw in satoshi.
   * @returns Withdrawal fee grouped by tBTC and Acre protocols in 1e8 satoshi
   *          precision and total withdrawal fee value.
   */
  async estimateWithdrawalFee(amount: bigint): Promise<WithdrawalFees> {
    const amountInTokenPrecision = fromSatoshi(amount)

    const { tbtc: tbtcFees } =
      await this.#contracts.bitcoinRedeemer.calculateWithdrawalFee(
        amountInTokenPrecision,
      )

    const withdrawalFee = await this.#contracts.acreBTC.calculateWithdrawalFee(
      amountInTokenPrecision,
    )

    const tbtc = toSatoshi(sumFees(tbtcFees))

    const acre = toSatoshi(withdrawalFee)

    return {
      tbtc: {
        fee: tbtc,
        isReimbursable: false,
      },
      acre: {
        fee: acre,
        isReimbursable: false,
      },
      total: tbtc + acre,
    }
  }

  /**
   * @returns Minimum deposit amount in 1e8 satoshi precision.
   */
  async minimumDepositAmount() {
    const value = await this.#contracts.bitcoinDepositor.minDepositAmount()
    return toSatoshi(value)
  }
}
