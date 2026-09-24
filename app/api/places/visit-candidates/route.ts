import { NextResponse } from "next/server"
import { createHmac } from "node:crypto"
import { shareAuth } from "@/lib/place-share-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { visitCandidates } from "@/lib/trip-visit-nearby"
export const runtime = "nodejs"
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" }
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers })
  try {
    const { user } = await shareAuth(request)
    if (!user) return fail("로그인 후 다시 이용해 주세요.", 401)
    const body = await request.json().catch(() => null)
    if (!body || typeof body.lat !== "number" || typeof body.lng !== "number" || !Number.isFinite(body.lat) || !Number.isFinite(body.lng) || Math.abs(body.lat) > 90 || Math.abs(body.lng) > 180) return fail("위치를 확인해 주세요.", 400)
    const db = getSupabaseAdmin(), secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!db || !secret) return fail("주변 장소 검색을 준비하고 있어요.", 503)
    const bucket = createHmac("sha256", secret).update(`visit:${user.id}:${new Date().toISOString().slice(0, 10)}`).digest("hex")
    const { data: count, error } = await db.rpc("bump_api_counter", { p_bucket: `visit:${bucket}`, p_ttl_seconds: 172800 })
    if (error || typeof count !== "number") return fail("검색 횟수를 확인하지 못했어요.", 503)
    if (count > 20) return fail("오늘의 자동 주변 검색 20회를 사용했어요. 기록은 계속 보관돼요. 가게 이름으로 확인해 주세요.", 429)
    return NextResponse.json({ results: await visitCandidates(body.lat, body.lng) }, { headers })
  } catch { return fail("주변 장소를 불러오지 못했어요. 가게 이름으로 검색하거나 잠시 후 다시 시도해 주세요.", 503) }
}
