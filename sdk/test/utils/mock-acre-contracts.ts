import {
  AcreContracts,
  BitcoinDepositor,
  BitcoinRedeemer,
  StBTC,
} from "../../src/lib/contracts"

// eslint-disable-next-line import/prefer-default-export
export class MockAcreContracts implements AcreContracts {
  public readonly bitcoinDepositor: BitcoinDepositor

  public readonly stBTC: StBTC

  public readonly bitcoinRedeemer: BitcoinRedeemer

  constructor() {
    this.bitcoinDepositor = {
      getChainIdentifier: jest.fn(),
      getTbtcVaultChainIdentifier: jest.fn(),
      decodeExtraData: jest.fn(),
      encodeExtraData: jest.fn(),
      revealDeposit: jest.fn(),
      calculateDepositFee: jest.fn(),
      minDepositAmount: jest.fn(),
      bridgeFeesReimbursementThreshold: jest.fn(),
    } as BitcoinDepositor

    this.stBTC = {
      totalAssets: jest.fn(),
      balanceOf: jest.fn(),
      assetsBalanceOf: jest.fn(),
      calculateDepositFee: jest.fn(),
      calculateWithdrawalFee: jest.fn(),
      previewRedeem: jest.fn(),
      getChainIdentifier: jest.fn(),
      convertToShares: jest.fn(),
      encodeApproveAndCallFunctionData: jest.fn(),
    } as StBTC

    this.bitcoinRedeemer = {
      getChainIdentifier: jest.fn(),
      calculateWithdrawalFee: jest.fn(),
    } as BitcoinRedeemer
  }
}
