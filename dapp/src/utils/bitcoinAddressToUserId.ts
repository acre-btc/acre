import { sha256, toUtf8Bytes } from "ethers"

/**
 * Converts a Bitcoin address to a user ID for telemetry.
 *
 * The Bitcoin address is first converted to lowercase and then hashed using SHA-256.
 * The resulting hash is then converted to a hexadecimal string and the first 10
 * characters are set as the user ID.
 *
 * @param bitcoinAddress - The Bitcoin address of the user.
 */
export default function bitcoinAddressToUserId(bitcoinAddress: string) {
  const hashedBitcoinAddress = sha256(toUtf8Bytes(bitcoinAddress.toLowerCase()))
  // Remove the 0x prefix and take the first 10 characters.
  return hashedBitcoinAddress.slice(2, 12)
}
