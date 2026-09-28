import { getSupabaseAdmin } from "@/lib/supabase-admin"

/** Never persist provider messages, keys, prompts, or shared post contents. */
export function isAiBillingFailure(status: number, message = ""): boolean {
  return status === 402 || ([403, 429].includes(status) && /prepay|credit.{0,30}(deplet|exhaust|balance)|billing.{0,30}(disabled|inactive|required)/i.test(message))
}

const notifiedDays = new Set<string>()

/** Event driven: at most one admin notification per UTC day, across instances.
 * A missing migration/DB must not break the caller or suppress later retries.
 */
export async function reportAiBillingFailure(status: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  if (notifiedDays.has(day)) return
  const db = getSupabaseAdmin()
  if (!db) return
  try {
    const { error } = await db.from("ai_billing_alerts").upsert({
      provider: "gemini", alert_day: day, http_status: status,
    }, { onConflict: "provider,alert_day", ignoreDuplicates: true })
    if (error) { console.warn("[ai-health] administrator alert unavailable"); return }
    notifiedDays.clear()
    notifiedDays.add(day)
  } catch { console.warn("[ai-health] administrator alert unavailable") }
}
