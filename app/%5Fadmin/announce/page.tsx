import { getSupabaseAdmin } from "@/lib/supabase-admin"

import { AnnounceForm } from "./form"
import { when } from "../format"

export const dynamic = "force-dynamic"

/** 받는 사람 수와 그중 푸시가 실제로 갈 사람 수 */
async function audience() {
  const c = getSupabaseAdmin()
  if (!c) return { users: 0, pushable: 0, ios: 0, android: 0 }

  const [{ data: list }, { data: tokens }] = await Promise.all([
    c.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    c.from("device_push_tokens").select("user_id,platform"),
  ])

  const now = Date.now()
  const active = (list?.users ?? []).filter((u) => {
    const until = (u as unknown as { banned_until?: string }).banned_until
    return !(until && new Date(until).getTime() > now)
  })
  const activeIds = new Set(active.map((u) => u.id))

  const rows = (tokens ?? []) as { user_id: string; platform: string | null }[]
  const withToken = new Set(rows.filter((t) => activeIds.has(t.user_id)).map((t) => t.user_id))

  return {
    users: active.length,
    pushable: withToken.size,
    ios: rows.filter((t) => t.platform === "ios" && activeIds.has(t.user_id)).length,
    android: rows.filter((t) => t.platform === "android" && activeIds.has(t.user_id)).length,
  }
}

/** 지난 공지 — 같은 걸 두 번 보내는 걸 막는다 */
async function past() {
  const c = getSupabaseAdmin()
  if (!c) return []
  const { data } = await c
    .from("notifications")
    .select("message,created_at,is_read")
    .eq("type", "announcement")
    .order("created_at", { ascending: false })
    .limit(400)

  const rows = (data ?? []) as { message: string; created_at: string; is_read: boolean }[]
  // 한 번 보내면 사람 수만큼 줄이 생긴다 — 내용+시각으로 묶어 한 건으로 본다
  const byBatch = new Map<string, { message: string; at: string; total: number; read: number }>()
  for (const r of rows) {
    const key = `${r.message}|${r.created_at.slice(0, 16)}`
    const cur = byBatch.get(key) ?? { message: r.message, at: r.created_at, total: 0, read: 0 }
    cur.total++
    if (r.is_read) cur.read++
    byBatch.set(key, cur)
  }
  return [...byBatch.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10)
}

export default async function AnnouncePage() {
  const [aud, history] = await Promise.all([audience().catch(() => null), past().catch(() => [])])

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>공지 보내기</h1>
          <div className="wt-sub">모든 사용자에게 알림 한 줄을 보냅니다</div>
        </div>
      </div>

      <section className="wt-tiles">
        <div className="wt-tile accent">
          <div className="k">받는 사람</div>
          <div className="v">
            {aud?.users ?? 0}
            <small>명</small>
          </div>
          <div className="d">정지된 사람은 뺐습니다</div>
        </div>
        <div className="wt-tile">
          <div className="k">푸시가 즉시 가는 사람</div>
          <div className="v">
            {aud?.pushable ?? 0}
            <small>명</small>
          </div>
          <div className="d">
            iOS {aud?.ios ?? 0} · 안드로이드 {aud?.android ?? 0}
          </div>
        </div>
        <div className="wt-tile">
          <div className="k">나머지</div>
          <div className="v">
            {Math.max((aud?.users ?? 0) - (aud?.pushable ?? 0), 0)}
            <small>명</small>
          </div>
          <div className="d">앱을 열 때 알림함에서 봅니다</div>
        </div>
      </section>

      {aud && aud.android === 0 && aud.pushable > 0 && (
        <div className="wt-card" style={{ marginBottom: 12, borderColor: "var(--warn)" }}>
          <h2>안드로이드 기기가 하나도 안 잡혀 있습니다</h2>
          <div className="cap" style={{ marginBottom: 0 }}>
            푸시 토큰이 iOS 것뿐입니다. 안드로이드 사용자는 <b>푸시를 못 받고</b> 앱을 열어야 공지를 봅니다.
            (푸시 토큰은 실기기에서 앱을 켜고 알림을 허용해야 잡힙니다 — 에뮬레이터에서는 안 잡힙니다)
          </div>
        </div>
      )}

      <div className="wt-split">
        <AnnounceForm />

        <div className="wt-card">
          <h2>지난 공지</h2>
          <div className="cap">같은 내용을 두 번 보내지 않도록 확인하세요</div>
          {history.length === 0 ? (
            <div className="wt-empty">아직 보낸 공지가 없습니다</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>내용</th>
                  <th style={{ width: 92 }}>보낸 때</th>
                  <th className="wt-num" style={{ width: 60 }}>
                    읽음
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={`${h.at}-${h.message.slice(0, 20)}`}>
                    <td>{h.message}</td>
                    <td className="wt-muted">{when(h.at)}</td>
                    <td className="wt-num wt-muted">
                      {h.read}/{h.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
