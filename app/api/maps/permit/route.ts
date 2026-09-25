import { mapsBudgetBlocked, reserveMapsSpend } from "@/lib/google-maps-budget"
import { checkRateLimit } from "@/lib/rate-limit"
export const runtime = "nodejs"
export async function POST(request: Request) {
  const limited = await checkRateLimit(request, "cheap", "map-permit")
  if (limited) return limited
  if (!(await reserveMapsSpend("dynamic_map", 1, "/api/maps/permit"))) return mapsBudgetBlocked()
  return Response.json({ allowed: true }, { headers: { "Cache-Control": "no-store" } })
}
