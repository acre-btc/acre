import { RedeemerProxy } from "@keep-network/tbtc-v2.ts"
import { ethers } from "ethers"
import { SafeTransactionData } from "@orangekit/sdk"
import { EthereumAddress } from "../../src/lib/ethereum"
import { ChainIdentifier } from "../../src/lib/contracts"
import { Hex } from "../../src/lib/utils"
import OrangeKitTbtcRedeemerProxy from "../../src/lib/redeemer-proxy"
import { MockAcreContracts } from "../utils/mock-acre-contracts"
import { MockOrangeKitSdk } from "../utils/mock-orangekit"
import {
  MockBitcoinProvider,
  MockBitcoinProviderWithSignWithdrawMessage,
} from "../utils/mock-bitcoin-provider"
import { AcreBitcoinProvider } from "../../src/lib/bitcoin"

describe("OrangeKitTbtcRedeemerProxy", () => {
  let redeemer: RedeemerProxy
  const contracts = new MockAcreContracts()
  const orangeKitSdk = new MockOrangeKitSdk()
  const wallet = ethers.Wallet.createRandom()
  const account = {
    publicKey: wallet.publicKey,
    ethereumAddress: EthereumAddress.from(wallet.address),
    bitcoinAddress: "123",
  }
  const bitcoinProvider = new MockBitcoinProvider()
  const bitcoinProviderWithSignWithdrawMessage =
    new MockBitcoinProviderWithSignWithdrawMessage()
  const sharesAmount = 10n

  beforeEach(() => {
    redeemer = new OrangeKitTbtcRedeemerProxy(
      contracts,
      // @ts-expect-error we only mock used the orangeKit methods
      orangeKitSdk,
      account,
      bitcoinProvider,
      sharesAmount,
    )
  })

  describe("redeemerAddress", () => {
    it("should return correct redeemer address", () => {
      expect(
        redeemer.redeemerAddress().equals(account.ethereumAddress),
      ).toBeTruthy()
    })
  })

  describe("requestRedemption", () => {
    const mockedTxHash =
      "0x40ad6b863ec0be72d4a74bf02672340043dc23f2111d3465e3ccfdce94575e57"
    const mockedEncodedApproveAndCallData = Hex.from("1234")
    const mockedRedemptionData = Hex.from("5678")
    const mockedBitcoinRedeemerIdentifier = EthereumAddress.from(
      "0x999333A67C9B55E78B97b9C0b287EB4AAeBa3D3b",
    )
    const mockedAcreBTCIdentifier = EthereumAddress.from(
      "0x8FF2A98c1F08FD5a4D12bED447b90d4de045C10b",
    )
    const mockedMessageToSign = "test"
    const mockedSafeTxData = { to: "test" } as SafeTransactionData

    let result: Hex
    let spyOnSendTransaction: jest.SpyInstance<
      Promise<string>,
      [
        to: string,
        value: string,
        data: string,
        bitcoinAddress: string,
        publicKey: string,
        bitcoinSignMessageFn: (
          message: string,
          data: SafeTransactionData,
        ) => Promise<string>,
      ]
    >
    let spyOnBitcoinRedeemerIdentifier: jest.SpyInstance<ChainIdentifier, []>

    let spyOnAcreBTCIdentifier: jest.SpyInstance<ChainIdentifier, []>

    let spyOnEncodeData: jest.SpyInstance<
      Hex,
      [spender: ChainIdentifier, amount: bigint, extraData: Hex]
    >

    describe.each<{
      provider: AcreBitcoinProvider
      description: string
      functionToCall: "signWithdrawMessage" | "signMessage"
      functionArgs: [string, SafeTransactionData] | [string]
    }>([
      {
        provider: bitcoinProviderWithSignWithdrawMessage,
        description:
          "when the bitcoin provider implements the `signWithdrawMessage` function",
        functionToCall: "signWithdrawMessage",
        functionArgs: [mockedMessageToSign, mockedSafeTxData],
      },
      {
        provider: bitcoinProvider,
        description:
          "when the bitcoin provider does not implement the `signWithdrawMessage` function",
        functionToCall: "signMessage",
        functionArgs: [mockedMessageToSign],
      },
    ])("$description", ({ provider, functionToCall, functionArgs }) => {
      let spies: jest.SpyInstance[]

      beforeAll(async () => {
        spyOnSendTransaction = jest
          .spyOn(orangeKitSdk, "sendTransaction")
          .mockResolvedValueOnce(mockedTxHash)
        spyOnBitcoinRedeemerIdentifier = jest
          .spyOn(contracts.bitcoinRedeemer, "getChainIdentifier")
          .mockReturnValueOnce(mockedBitcoinRedeemerIdentifier)
        spyOnAcreBTCIdentifier = jest
          .spyOn(contracts.acreBTC, "getChainIdentifier")
          .mockReturnValueOnce(mockedAcreBTCIdentifier)
        spyOnEncodeData = jest
          .spyOn(contracts.acreBTC, "encodeApproveAndCallFunctionData")
          .mockReturnValueOnce(mockedEncodedApproveAndCallData)

        spies = [
          spyOnSendTransaction,
          spyOnBitcoinRedeemerIdentifier,
          spyOnAcreBTCIdentifier,
          spyOnEncodeData,
        ]

        redeemer = new OrangeKitTbtcRedeemerProxy(
          contracts,
          // @ts-expect-error we only mock used the orangeKit methods
          orangeKitSdk,
          account,
          provider,
          sharesAmount,
        )

        result = await redeemer.requestRedemption(mockedRedemptionData)
      })

      afterAll(() => {
        spies.forEach((spy) => spy.mockClear())
      })

      it("should get the bitcoin redeemer contract's address", () => {
        expect(spyOnBitcoinRedeemerIdentifier).toHaveBeenCalled()
      })

      it("should encode approve and call data function", () => {
        expect(spyOnEncodeData).toHaveBeenCalledWith(
          mockedBitcoinRedeemerIdentifier,
          sharesAmount,
          mockedRedemptionData,
        )
      })

      it("should get the acreBTC contract's address", () => {
        expect(spyOnAcreBTCIdentifier).toHaveBeenCalled()
      })

      it("should send transaction via orange kit", () => {
        expect(spyOnSendTransaction).toHaveBeenCalledWith(
          `0x${mockedAcreBTCIdentifier.identifierHex}`,
          "0x0",
          mockedEncodedApproveAndCallData.toPrefixedString(),
          account.bitcoinAddress,
          account.publicKey,
          expect.any(Function),
        )
      })

      it("the sign message function passed to the orange kit should call the bitcoin provider", async () => {
        const signMessageFn = spyOnSendTransaction.mock.calls[0][5]

        await signMessageFn(mockedMessageToSign, mockedSafeTxData)

        expect(provider[functionToCall]).toHaveBeenCalledWith(...functionArgs)
      })

      it("should return tx hash", () => {
        expect(result.equals(Hex.from(mockedTxHash))).toBeTruthy()
      })
    })
  })
})
