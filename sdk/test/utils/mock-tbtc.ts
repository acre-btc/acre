import { TBTC as TbtcSdk } from "@keep-network/tbtc-v2.ts"

import Tbtc from "../../src/modules/tbtc"
import TbtcApi from "../../src/api/TbtcApi"

import { BitcoinDepositor } from "../../src/lib/contracts"

// eslint-disable-next-line import/prefer-default-export
export class MockTbtc extends Tbtc {
  constructor() {
    const tbtcApi = jest.fn() as unknown as TbtcApi
    const tbtcSdk = jest.fn() as unknown as TbtcSdk
    const bitcoinDepositor = jest.fn() as unknown as BitcoinDepositor

    super(tbtcApi, tbtcSdk, bitcoinDepositor)
  }
}
