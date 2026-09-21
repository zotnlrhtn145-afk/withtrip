import { selectWidyContext, widyContextText, type WidyTripContext } from "@/lib/widy-trip-context"
import { randomUUID } from "node:crypto"
import { after, NextResponse } from "next/server"
import { shareAuth } from "@/lib/place-share-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { POST as routeQuestion } from "@/app/api/widy-chat/route"
import { POST as findPlaces } from "@/app/api/concierge/route"
import { POST as draftDays } from "@/app/api/draft-itinerary/route"

export const runtime = "nodejs"
export const maxDuration = 180
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const { db, user } = await shareAuth(request)
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 })
  const tripId = new URL(request.url).searchParams.get("tripId") ?? ""
  if (!uuid.test(tripId)) return NextResponse.json({ error: "여행을 확인해 주세요." }, { status: 400 })
  const { data, error } = await db.from("widy_turns").select("question_id,reply_id,state,created_at").eq("trip_id", tripId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
  if (error) return NextResponse.json({ error: "진행 상태를 확인하지 못했어요." }, { status: 503 })
  // 강제 서버 종료도 영구 로딩으로 남기지 않습니다. 임의 재실행/중복 과금은 하지 않습니다.
  return NextResponse.json({ turns: (data ?? []).map(t => ({ ...t, state: t.state === "running" && Date.now() - Date.parse(t.created_at) > 200_000 ? "failed" : t.state })) }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const { db, user } = await shareAuth(request)
  if (!user) return NextResponse.json({ error: "로그인 후 다시 이용해 주세요." }, { status: 401 })
  let body: { questionId?: string; accommodation?: unknown; existingNames?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: "질문을 확인해 주세요." }, { status: 400 }) }
  if (!uuid.test(body.questionId ?? "")) return NextResponse.json({ error: "질문을 먼저 저장해 주세요." }, { status: 400 })
  // 요청자가 저장한 질문 + 현재 여행 참여 권한을 사용자 RLS로 확인합니다.
  const { data: question } = await db.from("trip_messages").select("id,trip_id,content").eq("id", body.questionId!).eq("user_id", user.id).eq("kind", "widy_q").is("deleted_at", null).maybeSingle()
  if (!question) return NextResponse.json({ error: "질문을 찾을 수 없어요." }, { status: 404 })
  const { data: participant } = await db.rpc("is_trip_participant", { p_trip_id: question.trip_id })
  if (!participant) return NextResponse.json({ error: "이 여행의 참여자만 이용할 수 있어요." }, { status: 403 })
  const admin = getSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 503 })
  const replyId = randomUUID()
  const { error } = await admin.from("widy_turns").insert({ question_id: question.id, trip_id: question.trip_id, user_id: user.id, reply_id: replyId })
  if (error) {
    if (error.code === "23505") return NextResponse.json({ accepted: true }, { status: 202 })
    return NextResponse.json({ error: "답변 요청을 접수하지 못했어요." }, { status: 503 })
  }
  // after는 응답/휴대폰 연결이 끝나도 서버 작업을 유지합니다. 인증 토큰은 DB에 쓰지 않습니다.
  const headers = new Headers(request.headers)
  headers.set("Content-Type", "application/json")
  const origin = new URL(request.url).origin
  const step = (path: string, input: unknown) => new Request(`${origin}${path}`, { method: "POST", headers, body: JSON.stringify(input) })
  after(async () => {
    let failed = false
    const save = async (content: string, payload: object) => {
      const { error } = await db.from("trip_messages").insert({ id: replyId, trip_id: question.trip_id, user_id: user.id, kind: "widy", content, payload, reply_to: question.id })
      if (error && error.code !== "23505") throw new Error("reply_save_failed")
    }
    try {
      const [tripResult, recentResult, stayResult, transportResult, scheduleResult] = await Promise.all([
        db.from("trips").select("city,location,title,country_code,start_date,end_date").eq("id", question.trip_id).maybeSingle(),
        db.from("trip_messages").select("kind,content").eq("trip_id", question.trip_id).eq("user_id", user.id).in("kind", ["widy", "widy_q"]).neq("id", question.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
        db.from("trip_accommodations").select("id,name,address,check_in_date,check_in_time,check_out_date,check_out_time,lat,lng").eq("trip_id", question.trip_id).order("check_in_date").limit(60),
        db.from("trip_transports").select("transport_type,from_label,to_label,depart_date,depart_time,arrive_date,arrive_time").eq("trip_id", question.trip_id).order("depart_date").limit(120),
        db.from("trip_schedules").select("day_number,place_name,visit_time,address").eq("trip_id", question.trip_id).order("day_number").order("visit_time").limit(300),
      ])
      if ([tripResult, recentResult, stayResult, transportResult, scheduleResult].some(r => r.error)) throw new Error("trip_context_unavailable")
      const trip = tripResult.data, recent = recentResult.data
      if (!trip) throw new Error("trip_unavailable")
      const context: WidyTripContext = { trip, stays: stayResult.data ?? [], transports: transportResult.data ?? [], schedules: scheduleResult.data ?? [] }
      const originalQuery = String(question.content ?? "").slice(0, 400)
      const selection = selectWidyContext(context, originalQuery)
      const tripContext = widyContextText(context)
      const city = selection.city
      const totalDays = Math.min(60, Math.max(1, Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86400000) + 1 || 1))
      const input = { query: originalQuery, city, country: selection.country, tripContext, startDate: trip.start_date, days: totalDays, history: (recent ?? []).reverse().map(m => ({ role: m.kind === "widy" ? "widy" : "user", text: m.content })) }
      const response = await routeQuestion(step("/api/widy-chat", input))
      const route = await response.json()
      const target = selectWidyContext(context, originalQuery, route.stayId)
      if (!response.ok) await save(route.reply || "잠시 후 다시 이용해 주세요.", { t: "help" })
      else if (route.mode === "places" && target.needsStay) {
        await save("요청하신 도시·날짜의 기준 숙소 위치를 확정하지 못했어요. 어느 숙소 또는 며칠째 일정 주변을 찾아드릴까요?", { t: "help" })
      } else if (route.mode === "places" && target.city) {
        const result = await findPlaces(step("/api/concierge", { query: route.search || input.query, widyTicket: route.widyTicket, city: target.city, country: target.country, tripContext, tripId: question.trip_id, accommodation: target.accommodation, existingNames: [...new Set(context.schedules.map(s => s.place_name).filter(Boolean))] }))
        const data = await result.json()
        const results = Array.isArray(data.results) ? data.results.slice(0, 50) : []
        await save(results.length ? `위디 추천 — ${results.length}곳${data.notice ? `\n${data.notice}` : ""}` : data.error || "맞는 곳을 찾지 못했어요. 다르게 물어봐 주세요.", results.length ? { t: "places", query: String(route.search || input.query).slice(0, 20), results } : { t: "help" })
      } else if (route.mode === "blocks" && city) {
        const response = await draftDays(step("/api/draft-itinerary", { ...input, query: route.search || input.query }))
        const data = await response.json()
        await save(data.days?.length ? `위디 제안 — ${data.days.length}일` : data.error || "초안을 만들지 못했어요.", data.days?.length ? { t: "blocks", status: "proposed", days: data.days } : { t: "help" })
      } else if (route.mode === "schedule" && route.schedule?.title) {
        const sc = route.schedule
        if (!Number.isInteger(sc.day) || sc.day < 1 || sc.day > totalDays) await save(`「${sc.title}」을(를) 여행의 며칠째에 넣을까요?`, { t: "help" })
        else {
          const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(sc.time ?? "") ? sc.time : null
          const { error } = await db.from("trip_schedules").insert({ id: replyId, trip_id: question.trip_id, created_by: user.id, day_number: sc.day, category: "관광", place_name: sc.title, visit_time: time })
          if (error && error.code !== "23505") throw new Error("schedule_save_failed")
          await save(`Day ${sc.day}${time ? ` ${time}` : ""}에 「${sc.title}」 넣었어요 — 일정 탭에서 확인하세요.`, { t: "help" })
        }
      } else await save(route.reply || (city ? "지금 답을 만들지 못했어요. 잠시 후 다시 말씀해 주세요." : "여행지(도시)를 먼저 정해 주세요."), { t: "help" })
    } catch (error) {
      failed = true
      const contextFailed = error instanceof Error && ["trip_context_unavailable", "trip_unavailable"].includes(error.message)
      await save(contextFailed ? "저장된 여행표를 불러오지 못했어요. 숙소와 일정을 확인해야 추천할 수 있어요. 잠시 후 다시 이용해 주세요." : "답변을 마무리하지 못했어요. 이미 추가된 일정은 일정 탭에서 확인해 주세요.", { t: "help" }).catch(() => {})
    } finally {
      await admin.from("widy_turns").update({ state: failed ? "failed" : "done", finished_at: new Date().toISOString() }).eq("question_id", question.id)
    }
  })
  return NextResponse.json({ accepted: true }, { status: 202 })
}
