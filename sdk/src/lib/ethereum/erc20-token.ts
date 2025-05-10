import { Contract as EthersContract } from "ethers"
import { EthersContractWrapper, EthereumContractRunner } from "./contract"
import { EthereumAddress } from "./address"

const abi = ["function balanceOf(address owner) view returns (uint256)"]

export default class ERC20Token extends EthersContractWrapper<EthersContract> {
  constructor(runner: EthereumContractRunner, address: string) {
    super(
      {
        address,
        runner,
      },
      {
        address,
        abi,
      },
    )
  }

  async balanceOf(owner: EthereumAddress): Promise<bigint> {
    return (await this.instance.balanceOf(`0x${owner.identifierHex}`)) as bigint
  }
}
