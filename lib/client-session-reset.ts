/**
 * Clear client-side WithTrip caches so account switches / logout
 * never leak the previous user's local data into the next session.
 */
export function clearWithTripClientCaches() {
  if (typeof window === "undefined") return

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key) continue
      if (
        key === "withtrip:payout-account" ||
        key === "withtrip_recent_searches" ||
        key.startsWith("withtrip:trip-settled:") ||
        key.startsWith("withtrip:") ||
        key.startsWith("sb-") // defensive: orphaned supabase auth fragments
      ) {
        // Do not wipe active supabase auth cookies/storage mid-session via sb-
        // except on explicit logout — callers should run this AFTER signOut.
        if (key.startsWith("sb-")) continue
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      window.localStorage.removeItem(key)
    }
  } catch (err) {
    console.warn("[clearWithTripClientCaches] localStorage:", err)
  }

  try {
    window.sessionStorage.clear()
  } catch (err) {
    console.warn("[clearWithTripClientCaches] sessionStorage:", err)
  }

  try {
    window.dispatchEvent(new CustomEvent("withtrip:session-cleared"))
  } catch {
    // ignore
  }
}
