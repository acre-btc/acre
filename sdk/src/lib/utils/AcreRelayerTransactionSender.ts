import { TransactionRequest } from "ethers"
import { TransactionSender, TransactionSenderResponse } from "@orangekit/sdk"

/**
 * TransactionSender that POSTs to Acre's self-hosted relayer endpoint.
 * The endpoint sponsors gas for withdrawals against the project's relayer EOA
 * after validating the call decodes as Safe.execTransaction(...) and targets
 * an allowlisted Acre contract.
 */
export default class AcreRelayerTransactionSender implements TransactionSender {
  readonly #relayerUrl: string

  constructor(relayerUrl: string) {
    if (!relayerUrl) {
      throw new Error("AcreRelayerTransactionSender: relayerUrl is required")
    }
    this.#relayerUrl = relayerUrl.replace(/\/$/, "")
  }

  async sendTransaction(
    tx: TransactionRequest,
  ): Promise<TransactionSenderResponse> {
    const response = await fetch(`${this.#relayerUrl}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: Number(tx.chainId),
        to: tx.to,
        data: tx.data ?? "0x",
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `Acre relayer returned ${response.status}: ${text || response.statusText}`,
      )
    }

    const body = (await response.json()) as { hash?: string }
    if (!body.hash) {
      throw new Error("Acre relayer response missing hash")
    }
    return { hash: body.hash }
  }
}
