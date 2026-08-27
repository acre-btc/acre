/**
 * Fire-and-forget helper: if the promise rejects, log it and do not rethrow.
 *
 * Rethrowing inside `.catch()` would leave a second rejected promise that no
 * caller awaits, which surfaces as an unhandled rejection in runtimes that
 * enforce it.
 */
export default function logPromiseFailure<T>(promise: Promise<T>) {
  void promise.catch((error: unknown) => {
    console.error(error)
  })
}
