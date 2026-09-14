import { Hex } from "./hex"

/**
 * Callback triggered after the Safe transaction data has been built, before
 * the user is asked to sign anything.
 */
export type DataBuiltStepCallback = (safeTxData: Hex) => Promise<void>

/**
 * Callback triggered right before the message signing step.
 */
export type OnSignMessageStepCallback = (messageToSign: string) => Promise<void>

/**
 * Callback triggered once the message has been signed.
 */
export type MessageSignedStepCallback = (signedMessage: string) => Promise<void>
