import * as Sentry from "@sentry/react"
import bitcoinAddressToUserId from "#/utils/bitcoinAddressToUserId"

const initialize = (dsn: string) => {
  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
      Sentry.extraErrorDataIntegration(),
      Sentry.httpClientIntegration(),
    ],
    // Attach stacktrace to errors logged by `console.error`. This is useful for
    // the `captureConsoleIntegration` integration.
    attachStacktrace: true,
    // Performance Monitoring
    tracesSampleRate: 0.1,
  })
}

/**
 * Sets the user in Sentry with an ID from hashed Bitcoin address.
 *
 * @param bitcoinAddress - The Bitcoin address of the user. If undefined, the user
 * is set to null in Sentry.
 */
const setUser = (bitcoinAddress: string | undefined) => {
  if (!bitcoinAddress) {
    Sentry.setUser(null)
    return
  }

  const id = bitcoinAddressToUserId(bitcoinAddress)

  Sentry.setUser({ id })
}

const captureException = (exception: unknown) =>
  Sentry.captureException(exception)

export default {
  initialize,
  setUser,
  captureException,
}
