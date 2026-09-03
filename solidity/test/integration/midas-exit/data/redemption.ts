/* eslint-disable import/prefer-default-export */
/**
 * tBTC redemption data. Only valid at the block in `validAtBlock`.
 *
 * ---------------------------------------------------------------------------
 * Why we need this
 * ---------------------------------------------------------------------------
 * The last step of the test calls the real tBTC Bridge. `requestRedemption`
 * only accepts a request that names a wallet which is Live, together with that
 * wallet's current main UTXO. The Bridge recomputes
 * `keccak256(txHash | outputIndex | value)` and compares it with the
 * `mainUtxoHash` it stores for that wallet.
 *
 * Both of those change every time a wallet moves coins on the Bitcoin side.
 * That is why we cannot reuse the older data in `test/data/tbtc.ts`. It was
 * made for block 20971177, and that wallet is now Closed with a different UTXO.
 *
 * ---------------------------------------------------------------------------
 * How these values were found
 * ---------------------------------------------------------------------------
 * Copying the `mainUtxo` from a recent `Bridge.RedemptionRequested` event does
 * not work. By the time you fork, the wallet has usually moved its coins again.
 * (We tried it: an event about 5,000 blocks before the fork block already had
 * an old UTXO.) So we worked out the current UTXO instead:
 *
 *   1. Read `Bridge` logs backwards from `validAtBlock`, looking for
 *      `DepositsSwept` and `RedemptionsCompleted`. Each one marks a Bitcoin
 *      transaction that gave a wallet a new main UTXO. Note that
 *      `DepositsSwept` does not index its `walletPubKeyHash`, so you have to
 *      decode the log instead of reading the topics.
 *   2. Keep only wallets whose `Bridge.wallets(walletPubKeyHash).state` is Live
 *      (value 1) at `validAtBlock`.
 *   3. Get that transaction and decode its first argument, which is the
 *      `BitcoinTx.Info` tuple
 *      `(bytes4 version, bytes inputVector, bytes outputVector, bytes4 locktime)`.
 *   4. Work out the Bitcoin transaction id the same way `BTCUtils.hash256`
 *      does: `sha256(sha256(version | inputVector | outputVector | locktime))`.
 *   5. Read the outputs from `outputVector` (a compactSize count, then for each
 *      output an 8 byte little endian value and a script with a compactSize
 *      length) and compare every `(txid, index, value)` with the wallet's
 *      stored `mainUtxoHash` at `validAtBlock`.
 *
 * Step 5 checks itself: only the wallet's real change output gives the same
 * hash, so there is no guessing which output is the right one. The values below
 * are the first match we found.
 *
 * ---------------------------------------------------------------------------
 * If FORK_BLOCK changes
 * ---------------------------------------------------------------------------
 * These values stop working and the last step of the test fails on the Bridge
 * call. Repeat the steps above for the new block. Do not change single fields
 * by hand. The UTXO, the wallet and the block all have to match each other.
 */
export const redemptionFixture = {
  /**
   * Must be the same as FORK_BLOCK in `../helpers`. The test checks this, so a
   * wrong block gives a clear message instead of a confusing Bridge error.
   */
  validAtBlock: 25889595,

  /**
   * The transaction we worked the main UTXO out from (block 25889045).
   * https://etherscan.io/tx/0x09c91cad0a3dd3d360abd3807dd3b837815aa9eaed6e0ce5d474b3fd3a5c2be7
   */
  proofTransaction:
    "0x09c91cad0a3dd3d360abd3807dd3b837815aa9eaed6e0ce5d474b3fd3a5c2be7",

  /** A tBTC wallet that is Live at `validAtBlock`. */
  walletPubKeyHash: "0xec0f7d76e08bc2bf6775e97374bab956c46fa648",

  /**
   * That wallet's change output from `proofTransaction`. We checked that its
   * `keccak256(txHash | outputIndex | value)` is the same as
   * `Bridge.wallets(walletPubKeyHash).mainUtxoHash` at `validAtBlock`.
   */
  mainUtxo: {
    txHash:
      "0xdc109a7eee0d499acb1faf97b7547afbb57dcdd4287a311ffcf49d15c25e5eb6",
    txOutputIndex: 0,
    txOutputValue: 68494575578n,
  },

  /**
   * Where the BTC would be sent. This is a P2WPKH script with its length in
   * front (`0x16` means 22 bytes). The Bridge expects that length byte. Leaving
   * it out once broke real mainnet withdrawals, when we had our own encoder
   * (added in `2bf3fac1`, removed in `6ed72690`).
   *
   * We did not invent this address. It is Acre's own, taken from
   * `WithdrawalQueue` request 1, which was Acre's first test withdrawal and not
   * a real user's. We found it by opening the Safe `execTransaction`, then the
   * acreBTC `approveAndCall`, then its `redemptionData`, in
   * https://etherscan.io/tx/0x1d2980a5e55c9201445da5580aa65c304ea046728ee0def257d30469795bde1f
   * (block 23514839, sent by the OrangeKit Safe
   * 0xDcBC417BC341d1974d88B78Ac460e4e9306b9Ee0). We checked it two ways:
   *
   *   keccak256(0x0014<hash160>)
   *     = 0xaa0c73dee4d3456529288740c0cba4dcd7a266a0538d68b4b4d24e7acb73984b
   *     which is request 1's `redeemerOutputScriptHash` on chain
   *   bech32(v0, <hash160>)
   *     = bc1quv9n8egtcuz2f33qauvq7ny0hk4g76f804y5s3
   *
   * Request 1 saved the hash of the script WITHOUT the length byte, while
   * redemption data has it WITH the length byte. That is the sign of the old
   * encoder bug, and the reason request 1 can never be finished. We use the
   * version with the length byte. It also means our redemption key
   * (keccak256 = 0x446dfb31...) is different, so it cannot clash with that
   * old request, which is still waiting.
   */
  redeemerOutputScript: "0x160014e30b33e50bc704a4c620ef180f4c8fbdaa8f6927",

  /**
   * The smallest redemption the Bridge accepts, taken from
   * `Bridge.redemptionParameters()` at `validAtBlock` and changed into tBTC wei
   * (900,000 sat * 1e10). Anything smaller fails, so the test checks the
   * holder has more than this.
   */
  dustThresholdWei: 9000000000000000n,

  /**
   * How much this wallet can still pay out, in satoshi. It is
   * `mainUtxo.txOutputValue` minus `wallets(...).pendingRedemptionsValue` at
   * `validAtBlock`. It is much more than the test needs. We write it down so
   * that a failure later is easier to understand.
   */
  walletSpareCapacitySat: 68494575578n,
} as const
