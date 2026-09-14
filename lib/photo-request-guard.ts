/** Per server instance: merge duplicate requests and briefly back off after failure.
 * No photo bytes or successful responses are retained after the request completes.
 * This is not a distributed cache; separate instances can still fetch concurrently.
 */
export function createPhotoRequestGuard(now: () => number = Date.now) {
  const pending = new Map<string, Promise<Response>>()
  const failures = new Map<string, number>()
  const cooldownMs = 30_000
  const maxFailures = 1024
  const maxPending = 64

  function unavailable(seconds: number) {
    return Response.json({ error: "사진을 잠시 후 다시 불러와 주세요." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": String(seconds) },
    })
  }

  return async function guardedPhoto(key: string, load: () => Promise<Response>): Promise<Response> {
    const retryAt = failures.get(key)
    if (retryAt !== undefined) {
      if (retryAt > now()) return unavailable(Math.ceil((retryAt - now()) / 1000))
      failures.delete(key)
    }
    const existing = pending.get(key)
    if (existing) return (await existing).clone()
    if (pending.size >= maxPending) return unavailable(1)

    const task = Promise.resolve().then(load).catch(() => unavailable(30)).then(response => {
      if (response.status >= 500) {
        for (const [failedKey, expires] of failures) {
          if (expires <= now()) failures.delete(failedKey)
        }
        if (failures.size >= maxFailures) failures.delete(failures.keys().next().value!)
        failures.set(key, now() + cooldownMs)
      }
      return response
    })
    pending.set(key, task)
    try {
      return (await task).clone()
    } finally {
      pending.delete(key)
    }
  }
}
