import { randomUUID } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export type MapsOperation = "photo" | "geocode" | "dynamic_map" | "details" | "textsearch" | "nearbysearch" | "autocomplete" | "findplace" | "directions" | "distance_matrix"

/** null = not Maps; unsupported = fail closed for new/unpriced Maps APIs. */
export function mapsCharge(url: string): { operation: MapsOperation | "unsupported"; units: number } | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (!["maps.googleapis.com", "places.googleapis.com", "routes.googleapis.com"].includes(u.hostname)) return null
  const p = u.pathname
  if (p.includes("/place/photo") || (p.startsWith("/v1/places/") && p.endsWith("/media"))) return { operation: "photo", units: 1 }
  if (p.includes("/geocode/")) return { operation: "geocode", units: 1 }
  if (p.includes("/distancematrix/")) {
    const count = (key: string) => {
      const value = u.searchParams.get(key) || ""
      // Encoded polylines can contain multiple coordinates: do not underestimate.
      return !value || value.includes("enc:") ? 0 : value.split("|").length
    }
    return { operation: "distance_matrix", units: count("origins") * count("destinations") }
  }
  if (p.includes("/directions/")) return { operation: "directions", units: 1 }
  if (p.includes("/place/textsearch") || p === "/v1/places:searchText") return { operation: "textsearch", units: 1 }
  if (p.includes("/place/nearbysearch") || p === "/v1/places:searchNearby") return { operation: "nearbysearch", units: 1 }
  if (p.includes("/place/autocomplete") || p.includes("/place/queryautocomplete") || p === "/v1/places:autocomplete") return { operation: "autocomplete", units: 1 }
  if (p.includes("/place/findplacefromtext")) return { operation: "findplace", units: 1 }
  if (p.includes("/place/details") || /^\/v1\/places\/[^/]+$/.test(p)) return { operation: "details", units: 1 }
  return { operation: "unsupported", units: 0 }
}

export async function reserveMapsSpend(operation: MapsOperation | "unsupported", units = 1, caller: string | null = null): Promise<boolean> {
  if (operation === "unsupported" || !Number.isSafeInteger(units) || units < 1 || units > 625) return false
  const db = getSupabaseAdmin()
  if (!db) return false
  try {
    const { data, error } = await db.rpc("reserve_google_maps_budget", {
      p_request_id: randomUUID(), p_operation: operation, p_units: units, p_caller: caller,
    })
    return !error && data?.allowed === true
  } catch { return false }
}

export function mapsBudgetBlocked() {
  return Response.json({ error: "새 장소 조회가 일시 중지되었습니다. 관리자의 사용 한도 승인이 필요합니다.", code: "MAPS_APPROVAL_REQUIRED", status: "REQUEST_DENIED" }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" },
  })
}

export async function readMapsBudget() {
  const db = getSupabaseAdmin()
  if (!db) return null
  const { data, error } = await db.from("google_maps_budget").select("approved_won,reserved_won,safety_won,version,paused,blocked_at").eq("id", true).maybeSingle()
  return error ? null : data as { approved_won: number; reserved_won: number; safety_won: number; version: number; paused: boolean; blocked_at: string | null } | null
}
