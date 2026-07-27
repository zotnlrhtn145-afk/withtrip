const STORAGE_PREFIX = "withtrip:trip-settled:"

export function getTripSettledFlag(tripId: string): boolean {
  if (typeof window === "undefined") return false
  const id = String(tripId ?? "").trim()
  if (!id) return false
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1"
  } catch {
    return false
  }
}

export function setTripSettledFlag(tripId: string, settled: boolean): void {
  if (typeof window === "undefined") return
  const id = String(tripId ?? "").trim()
  if (!id) return
  try {
    const key = `${STORAGE_PREFIX}${id}`
    if (settled) {
      window.localStorage.setItem(key, "1")
    } else {
      window.localStorage.removeItem(key)
    }
    window.dispatchEvent(
      new CustomEvent("withtrip:trip-settled", {
        detail: { tripId: id, settled },
      })
    )
  } catch {
    // ignore quota / private mode
  }
}
