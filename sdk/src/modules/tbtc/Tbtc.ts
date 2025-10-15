import {
  BitcoinAddressConverter,
  ChainIdentifier,
  TBTC as TbtcSdk,
} from "@keep-network/tbtc-v2.ts"

import { ethers, ZeroAddress } from "ethers"
import {
  constants as ethersv5Constants,
  getDefaultProvider,
  VoidSigner,
} from "ethers-v5"
import TbtcApi, { DepositStatus } from "../../lib/api/TbtcApi"
import { BitcoinDepositor } from "../../lib/contracts"
import { Hex } from "../../lib/utils"

import Deposit from "./Deposit"
import { BitcoinNetwork } from "../../lib/bitcoin"

/**
 * Represents the tBTC module.
 */
export default class Tbtc {
  readonly #tbtcApi: TbtcApi

  readonly #tbtcSdk: TbtcSdk

  readonly #bitcoinDepositor: BitcoinDepositor

  readonly #network: BitcoinNetwork

  constructor(
    tbtcApi: TbtcApi,
    tbtcSdk: TbtcSdk,
    bitcoinDepositor: BitcoinDepositor,
    network: BitcoinNetwork,
  ) {
    this.#tbtcApi = tbtcApi
    this.#tbtcSdk = tbtcSdk
    this.#bitcoinDepositor = bitcoinDepositor
    this.#network = network
  }

  /**
   * Initializes the Tbtc module.
   *
   * @param network The Ethereum network.
   * @param ethereumRpcUrl The Ethereum RPC URL.
   * @param tbtcApiUrl The tBTC API URL.
   * @param bitcoinDepositor The Bitcoin depositor contract handle.
   * @returns A Promise that resolves to an instance of Tbtc.
   */
  static async initialize(
    network: BitcoinNetwork,
    ethereumRpcUrl: string,
    tbtcApiUrl: string,
    bitcoinDepositor: BitcoinDepositor,
  ): Promise<Tbtc> {
    const tbtcApi = new TbtcApi(tbtcApiUrl)
    const signer = new VoidSigner(
      ZeroAddress,
      getDefaultProvider(ethereumRpcUrl),
    )

    const tbtcSdk =
      network === BitcoinNetwork.Mainnet
        ? await TbtcSdk.initializeMainnet(signer)
        : await TbtcSdk.initializeSepolia(signer)

    return new Tbtc(tbtcApi, tbtcSdk, bitcoinDepositor, network)
  }

  /**
   * Function to initialize a tBTC deposit. It submits deposit data to the tBTC
   * API and returns the deposit object.
   * @param depositOwner Ethereum address of the deposit owner.
   * @param bitcoinRecoveryAddress P2PKH or P2WPKH Bitcoin address that can be
   *        used for emergency recovery of the deposited funds.
   * @param referral Deposit referral number.
   * @param loggedInUser Identifier of the user who initiated the deposit.
   */
  async initiateDeposit(
    depositOwner: ChainIdentifier,
    bitcoinRecoveryAddress: string,
    referral: number,
    loggedInUser: string,
  ): Promise<Deposit> {
    if (!depositOwner || !bitcoinRecoveryAddress) {
      throw new Error("Ethereum or Bitcoin address is not available")
    }

    const extraData = this.#bitcoinDepositor.encodeExtraData(
      depositOwner,
      referral,
    )

    const tbtcDeposit = await this.#tbtcSdk.deposits.initiateDepositWithProxy(
      bitcoinRecoveryAddress,
      this.#bitcoinDepositor,
      extraData,
    )

    const receipt = tbtcDeposit.getReceipt()

    const revealData = {
      address: depositOwner.identifierHex,
      revealInfo: {
        depositor: receipt.depositor.identifierHex,
        blindingFactor: receipt.blindingFactor.toString(),
        walletPublicKeyHash: receipt.walletPublicKeyHash.toString(),
        refundPublicKeyHash: receipt.refundPublicKeyHash.toString(),
        refundLocktime: receipt.refundLocktime.toString(),
        extraData: receipt.extraData!.toString(),
      },
      metadata: {
        depositOwner: depositOwner.identifierHex,
        referral,
      },
      application: "acre",
      loggedInUser,
    }

    const revealSaved: boolean = await this.#tbtcApi.saveReveal(revealData)
    if (!revealSaved)
      throw new Error("Reveal not saved properly in the database")

    return new Deposit(this.#tbtcApi, tbtcDeposit, revealData)
  }

  /**
   * @param depositOwner Depositor as EVM-chain identifier.
   * @returns All owner deposits, including queued deposits.
   */
  async getDepositsByOwner(depositOwner: ChainIdentifier): Promise<
    {
      txHash: string
      depositKey: string
      initialAmount: bigint
      status: DepositStatus
      initializedAt: number
    }[]
  > {
    const deposits = await this.#tbtcApi.getDepositsByOwner(depositOwner)

    return deposits.map((deposit) => ({
      status: deposit.status,
      initialAmount: BigInt(deposit.initialAmount),
      depositKey: ethers.solidityPackedKeccak256(
        ["bytes32", "uint32"],
        [
          Hex.from(deposit.txHash).reverse().toPrefixedString(),
          deposit.outputIndex,
        ],
      ),
      txHash: deposit.txHash,
      initializedAt: deposit.createdAt,
    }))
  }

  /**
   * Prepare tBTC Redemption Data in the raw bytes format expected by the
   * WithdrawalQueue contract. The data is used to requests a redemption with
   * bridging to Bitcoin.
   * @param redeemer Chain identifier of the redeemer. This is the address that
   *        will be able to claim the tBTC tokens if anything goes wrong during
   *        the redemption process.
   * @param bitcoinAddress The bitcoin address that the redeemed funds will be
   *        locked to.
   */
  buildRedemptionData(redeemer: ChainIdentifier, bitcoinAddress: string) {
    // We only need encode `redeemer` and `redeemerOutputScript`. Other values
    // can be empty because the are not used in the contract.
    return this.#tbtcSdk.tbtcContracts.tbtcToken.buildRequestRedemptionData(
      redeemer,
      Hex.from(
        // The Ethereum address is 20 bytes so we can use it as "empty"
        // `bytes20` type.
        ethers.ZeroAddress,
      ),
      {
        outputIndex: 0,
        transactionHash: Hex.from(ethers.encodeBytes32String("")),
        value: ethersv5Constants.Zero,
      },
      BitcoinAddressConverter.addressToOutputScript(
        bitcoinAddress,
        this.#network,
      ),
    )
  }
}
