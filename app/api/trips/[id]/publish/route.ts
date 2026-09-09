import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/utils/supabase/server"
import { makeTemplateSlug, sanitizeThemes } from "@/shared/trip-templates"

/**
 * 템플릿으로 공개 / 비공개 되돌리기. (발행 UI 는 앱 — 이 창구를 부른다)
 *
 * 몸통: { publish: boolean, city?, countryCode?, themes?: string[], description? }
 *
 * ⚠️ 소유자만. 세션으로 사람을 확인하고, 갱신은 service role 로 한다
 *    (trips 의 기존 RLS 정책이 어떤 열을 막는지에 기대지 않기 위해).
 * ⚠️ 테마는 12개 고정 목록과 대조해 거른다 — 자유 태그를 열면 묶음이 깨진다.
 * ⚠️ 일정 5곳 미만이면 공개를 막는다 — 빈 템플릿이 진열대를 후지게 만든다.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 })

  const { data: trip } = await admin
    .from("trips")
    .select("id, user_id, title, start_date, end_date, city, country_code, slug")
    .eq("id", id)
    .maybeSingle()
  if (!trip) return NextResponse.json({ error: "여행을 찾을 수 없어요" }, { status: 404 })
  if (trip.user_id !== user.id) return NextResponse.json({ error: "여행의 주인만 공개할 수 있어요" }, { status: 403 })

  let body: {
    publish?: boolean
    city?: string
    countryCode?: string
    themes?: unknown
    description?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했어요" }, { status: 400 })
  }

  if (body.publish === false) {
    await admin.from("trips").update({ is_public: false }).eq("id", id)
    return NextResponse.json({ ok: true, isPublic: false })
  }

  const { count } = await admin
    .from("trip_schedules")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", id)
  if ((count ?? 0) < 5) {
    return NextResponse.json({ error: "일정을 5곳 이상 채우면 공개할 수 있어요" }, { status: 400 })
  }

  const city = String(body.city ?? trip.city ?? "").trim() || null
  const countryCode = String(body.countryCode ?? trip.country_code ?? "").trim().toUpperCase() || null
  const themes = sanitizeThemes(body.themes)
  const description = String(body.description ?? "").trim().slice(0, 300) || null
  const slug =
    trip.slug ??
    makeTemplateSlug({ city, startDate: trip.start_date, endDate: trip.end_date, themes, id: String(trip.id) })

  const { error } = await admin
    .from("trips")
    .update({
      is_public: true,
      slug,
      city,
      country_code: countryCode,
      tag_list: themes,
      description,
      published_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) return NextResponse.json({ error: "공개하지 못했어요" }, { status: 500 })

  return NextResponse.json({ ok: true, isPublic: true, slug, url: `/templates/${encodeURIComponent(slug)}` })
}
