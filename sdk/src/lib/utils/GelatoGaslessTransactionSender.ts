import { TransactionRequest } from "ethers"
import { TransactionSender, TransactionSenderResponse } from "@orangekit/sdk"
import {
  createGelatoEvmRelayerClient,
  type GelatoEvmRelayerClient,
} from "@gelatocloud/gasless"

export default class GelatoGaslessTransactionSender
  implements TransactionSender
{
  #relay: GelatoEvmRelayerClient

  constructor(relayApiKey: string) {
    this.#relay = createGelatoEvmRelayerClient({ apiKey: relayApiKey })
  }

  async sendTransaction(
    tx: TransactionRequest,
  ): Promise<TransactionSenderResponse> {
    try {
      const result = await this.#relay.sendTransactionSync({
        chainId: Number(tx.chainId),
        to: tx.to as `0x${string}`,
        data: (tx.data as `0x${string}`) ?? "0x",
      })

      // eslint-disable-next-line no-console
      console.log(`Transaction successful with hash: ${result.transactionHash}`)
      return { hash: result.transactionHash ?? "0x" }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`Error relaying transaction: ${String(error)}`)
      throw error
    }
  }
}
