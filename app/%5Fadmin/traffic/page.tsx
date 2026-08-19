import Link from "next/link"

import { fetchCategoryVisits, fetchDailyVisits } from "@/lib/admin-data"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

import { BarAxis, BarChart, RankBars } from "../charts"
import { dayList, seoulToday } from "../format"

export const dynamic = "force-dynamic"

const RANGES = [
  { key: "7", label: "최근 7일", days: 7 },
  { key: "30", label: "최근 30일", days: 30 },
  { key: "90", label: "최근 90일", days: 90 },
] as const

/** 어느 화면을 많이 보는지 — 분류보다 한 단계 더 자세히 */
async function topPaths(from: string, to: string) {
  const c = getSupabaseAdmin()
  if (!c) return []
  const { data } = await c
    .from("page_views")
    .select("path,source")
    .gte("at", from)
    .lt("at", `${to}T23:59:59.999Z`)
    .limit(20_000)

  const n = new Map<string, { web: number; app: number }>()
  for (const r of (data ?? []) as { path: string; source: string }[]) {
    const cur = n.get(r.path) ?? { web: 0, app: 0 }
    if (r.source === "app") cur.app++
    else cur.web++
    n.set(r.path, cur)
  }
  return [...n.entries()]
    .map(([path, v]) => ({ path, ...v, total: v.web + v.app }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15)
}

export default async function TrafficPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams
  const range = RANGES.find((r) => r.key === sp.r) ?? RANGES[1]
  const today = seoulToday()
  const from = new Date(Date.now() + 9 * 3600_000 - (range.days - 1) * 86_400_000).toISOString().slice(0, 10)
  const days = dayList(from, today)

  const [visits, cats, paths] = await Promise.all([
    fetchDailyVisits(from, today).catch(() => []),
    fetchCategoryVisits(from, today).catch(() => []),
    topPaths(from, today).catch(() => []),
  ])

  const byDay = new Map(visits.map((v) => [v.day, v]))
  const visitorPoints = days.map((d) => ({
    label: String(Number(d.slice(8, 10))),
    value: Number(byDay.get(d)?.visitors ?? 0),
    sub: `열람 ${byDay.get(d)?.views ?? 0}회`,
  }))
  const viewPoints = days.map((d) => ({
    label: String(Number(d.slice(8, 10))),
    value: Number(byDay.get(d)?.views ?? 0),
  }))

  const visitors = visits.reduce((s, v) => s + Number(v.visitors), 0)
  const views = visits.reduce((s, v) => s + Number(v.views), 0)
  const users = visits.reduce((s, v) => s + Number(v.users), 0)
  const webTotal = paths.reduce((s, p) => s + p.web, 0)
  const appTotal = paths.reduce((s, p) => s + p.app, 0)

  const empty = views === 0

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>트래픽</h1>
          <div className="wt-sub">
            {from} – {today} · 앱과 웹을 함께 셉니다
          </div>
        </div>
        <div className="wt-seg">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/_admin/traffic?r=${r.key}`} className={r.key === range.key ? "on" : ""}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {empty && (
        <div className="wt-card" style={{ marginBottom: 12 }}>
          <h2>아직 기록이 없습니다</h2>
          <div className="cap" style={{ marginBottom: 0 }}>
            방문 집계는 <b>새로 배포한 웹과 새 앱 빌드부터</b> 쌓입니다. 웹은 배포 직후부터, 앱은 다음 빌드를 설치한
            기기부터 잡힙니다.
          </div>
        </div>
      )}

      <section className="wt-tiles">
        <div className="wt-tile accent">
          <div className="k">방문자</div>
          <div className="v">{visitors.toLocaleString("ko-KR")}</div>
          <div className="d">같은 사람은 하루에 한 번만 셉니다</div>
        </div>
        <div className="wt-tile">
          <div className="k">열람</div>
          <div className="v">{views.toLocaleString("ko-KR")}</div>
          <div className="d">
            1인당 {visitors ? (views / visitors).toFixed(1) : "0"}회
          </div>
        </div>
        <div className="wt-tile">
          <div className="k">로그인 상태 방문</div>
          <div className="v">{users.toLocaleString("ko-KR")}</div>
          <div className="d">날짜별 로그인 사용자 수의 합</div>
        </div>
        <div className="wt-tile">
          <div className="k">앱 : 웹</div>
          <div className="v">
            {webTotal + appTotal > 0 ? Math.round((appTotal / (webTotal + appTotal)) * 100) : 0}
            <small>% 앱</small>
          </div>
          <div className="d">
            앱 {appTotal.toLocaleString("ko-KR")} · 웹 {webTotal.toLocaleString("ko-KR")}
          </div>
        </div>
      </section>

      <section className="wt-grid">
        <div className="wt-card">
          <h2>날짜별 방문자</h2>
          <div className="cap">하루에 한 번만 센 사람 수</div>
          <BarChart data={visitorPoints} highlightLast />
          <BarAxis data={visitorPoints} every={Math.max(1, Math.floor(days.length / 8))} />
        </div>
        <div className="wt-card">
          <h2>어느 분류를 많이 보나</h2>
          <div className="cap">열람 수 기준 — 여기가 다음에 손볼 곳입니다</div>
          <RankBars rows={cats.map((c) => ({ label: c.category, value: Number(c.views) }))} unit="회" />
        </div>
      </section>

      <section className="wt-grid">
        <div className="wt-card">
          <h2>날짜별 열람</h2>
          <div className="cap">화면을 연 횟수 (같은 사람이 여러 번 봐도 다 셉니다)</div>
          <BarChart data={viewPoints} highlightLast />
          <BarAxis data={viewPoints} every={Math.max(1, Math.floor(days.length / 8))} />
        </div>

        <div className="wt-card">
          <h2>가장 많이 본 화면</h2>
          <div className="cap">앱·웹을 나눠서</div>
          <div className="wt-scroll">
            <table>
              <thead>
                <tr>
                  <th>화면</th>
                  <th className="wt-num">앱</th>
                  <th className="wt-num">웹</th>
                  <th className="wt-num">합</th>
                </tr>
              </thead>
              <tbody>
                {paths.length === 0 && (
                  <tr>
                    <td colSpan={4} className="wt-empty">
                      아직 없습니다
                    </td>
                  </tr>
                )}
                {paths.map((p) => (
                  <tr key={p.path}>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.path}
                    </td>
                    <td className="wt-num wt-muted">{p.app.toLocaleString("ko-KR")}</td>
                    <td className="wt-num wt-muted">{p.web.toLocaleString("ko-KR")}</td>
                    <td className="wt-num">{p.total.toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  )
}
