import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { guessDestination } from "@/shared/trip-destination-guess"

/**
 * 기존 여행의 country_code·city 채우기 — 한 번 쓰는 분류 도구.
 *
 * trips.location 이 "부산 · 한국" 같은 자유 텍스트라 기계가 못 읽는다.
 * 추정기로 채우되, **못 맞추면 비워 둔다**(틀린 분류보다 낫다).
 * dryRun: true 면 뭘 채울지 보여만 준다.
 */
export async function POST(req: Request) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
  if (!secret || req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "관리자만 쓸 수 있습니다." }, { status: 403 })
  }
  const db = getSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "DB 연결 실패" }, { status: 500 })

  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean }
  const dryRun = body.dryRun === true

  const { data: trips, error } = await db
    .from("trips")
    .select("id, title, location, country_code, city")
    .eq("kind", "trip")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const plan: { id: string; title: string; location: string | null; countryCode: string | null; city: string | null }[] = []
  for (const t of trips ?? []) {
    if (t.country_code && t.city) continue // 이미 채워진 건 안 건드린다
    const g = guessDestination(t.location, t.title)
    if (!g.countryCode && !g.city) continue
    plan.push({ id: t.id, title: t.title, location: t.location, countryCode: g.countryCode, city: g.city })
  }

  if (!dryRun) {
    for (const p of plan) {
      await db
        .from("trips")
        .update({ country_code: p.countryCode ?? undefined, city: p.city ?? undefined })
        .eq("id", p.id)
    }
  }
  return NextResponse.json({ dryRun, planned: plan.length, plan })
}
