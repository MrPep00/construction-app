/** Messages browsers use for a failed network round-trip.
 *  Safari: "Load failed". Chrome/Firefox: "Failed to fetch". Firefox
 *  XHR / some polyfills: "NetworkError ...". Shared by the client
 *  reporter (to tag type: "fetch") and by ingestion (to downgrade
 *  severity when the client was offline) so the two can't drift. */
const NETWORK_FAILURE_PATTERNS = [
  "load failed",
  "failed to fetch",
  "networkerror",
] as const

export function isNetworkFailureMessage(message: string | undefined): boolean {
  if (!message) return false
  const haystack = message.toLowerCase()
  return NETWORK_FAILURE_PATTERNS.some((p) => haystack.includes(p))
}
