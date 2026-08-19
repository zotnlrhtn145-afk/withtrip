import Link from "next/link"

import { fetchCategoryVisits, fetchDailyVisits, fetchOverview } from "@/lib/admin-data"
import { fetchDailyApiCost, fetchMonthCosts, usdKrw } from "@/lib/admin-billing"

import { BarAxis, BarChart, RankBars, Sparkline } from "./charts"
import { dayList, krw, monthOf, seoulToday, usd } from "./format"

export const dynamic = "force-dynamic"

export default async function Dashboard() {
  const today = seoulToday()
  const month = monthOf(today)
  const from = month
  const days = dayList(from, today)

  const [overview, visits, cats, costs, apiCost, rate] = await Promise.all([
    fetchOverview().catch(() => null),
    fetchDailyVisits(from, today).catch(() => []),
    fetchCategoryVisits(from, today).catch(() => []),
    fetchMonthCosts(month).catch(() => []),
    fetchDailyApiCost(from, today).catch(() => []),
    usdKrw().catch(() => 1380),
  ])

  if (!overview) {
    return (
      <>
        <h1>대시보드</h1>
        <div className="wt-card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            데이터베이스를 읽지 못했습니다. <code>SUPABASE_SERVICE_ROLE_KEY</code> 가 설정돼 있는지,
            <code> supabase/admin-analytics.sql</code> 을 적용했는지 확인하세요.
          </p>
        </div>
      </>
    )
  }

  // ── 방문 ─────────────────────────────
  const visitByDay = new Map(visits.map((v) => [v.day, v]))
  const visitPoints = days.map((d) => ({
    label: String(Number(d.slice(8, 10))),
    value: visitByDay.get(d)?.visitors ?? 0,
    sub: `${visitByDay.get(d)?.views ?? 0}회 열람`,
  }))
  const visitorsThisMonth = visits.reduce((s, v) => s + Number(v.visitors), 0)
  const viewsThisMonth = visits.reduce((s, v) => s + Number(v.views), 0)

  // ── 비용 ─────────────────────────────
  const totalUsd = costs.reduce((s, c) => s + (c.currency === "USD" ? c.amount : 0), 0)
  const totalKrwDirect = costs.reduce((s, c) => s + (c.currency === "KRW" ? c.amount : 0), 0)
  const totalKrw = totalUsd * rate + totalKrwDirect

  const costByDay = new Map<string, number>()
  for (const r of apiCost) costByDay.set(r.day, (costByDay.get(r.day) ?? 0) + r.usd)
  const costPoints = days.map((d) => ({
    label: String(Number(d.slice(8, 10))),
    value: Number((costByDay.get(d) ?? 0).toFixed(4)),
    sub: krw((costByDay.get(d) ?? 0) * rate),
  }))

  /*
    이번 달이 이 속도로 끝나면 얼마가 될까.
    ⚠️ 고정비는 이미 한 달치가 통째로 들어 있다 — 거기에 날짜 비율을 곱하면
       "달이 끝날 때 30일치가 두 번" 꼴이 된다. **쓴 만큼 나가는 돈만** 늘려 잡는다.
  */
  const dayOfMonth = Number(today.slice(8, 10))
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
  const meteredUsd = costs.filter((c) => c.source === "metered").reduce((s, c) => s + c.amount, 0)
  const fixedUsd = totalUsd - meteredUsd
  const projectedUsd = fixedUsd + (meteredUsd / Math.max(dayOfMonth, 1)) * daysInMonth

  const catRows = cats.slice(0, 7).map((c) => ({ label: c.category, value: Number(c.views) }))

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>대시보드</h1>
          <div className="wt-sub">
            {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월 1일 – {dayOfMonth}일 · 한국시간 기준
          </div>
        </div>
        <div className="wt-seg">
          <Link className="on" href="/_admin">
            이번 달
          </Link>
          <Link href="/_admin/traffic">트래픽 자세히</Link>
          <Link href="/_admin/costs">비용 자세히</Link>
        </div>
      </div>

      <section className="wt-tiles">
        <div className="wt-tile accent">
          <div className="k">이번 달 나간 돈</div>
          <div className="v">
            {krw(totalKrw)}
            <small>원</small>
          </div>
          <div className="d">
            {usd(totalUsd)} · 이 속도면 월말 <b>{krw(projectedUsd * rate)}원</b>
          </div>
        </div>

        <div className="wt-tile">
          <div className="k">이번 달 방문자</div>
          <div className="v">{visitorsThisMonth.toLocaleString("ko-KR")}</div>
          <div className="d">열람 {viewsThisMonth.toLocaleString("ko-KR")}회</div>
          <div style={{ marginTop: 6 }}>
            <Sparkline values={visitPoints.map((p) => p.value)} />
          </div>
        </div>

        <div className="wt-tile">
          <div className="k">가입자</div>
          <div className="v">{overview.users.toLocaleString("ko-KR")}</div>
          <div className="d">
            최근 30일 <span className="wt-up">+{overview.users_new_30d}</span>
          </div>
        </div>

        <div className="wt-tile">
          <div className="k">쌓인 것</div>
          <div className="v">
            {overview.places.toLocaleString("ko-KR")}
            <small>곳</small>
          </div>
          <div className="d">
            여행 {overview.trips} · 클립 {overview.clips} · 리뷰 {overview.reviews}
          </div>
        </div>
      </section>

      <section className="wt-grid">
        <div className="wt-card">
          <h2>날짜별 방문자</h2>
          <div className="cap">이번 달 · 같은 사람은 하루에 한 번만 셉니다</div>
          <BarChart data={visitPoints} highlightLast />
          <BarAxis data={visitPoints} />
          <div className="wt-note">막대에 손을 올리면 그날 숫자가 보입니다. 마지막 칸(호박색)은 아직 진행 중인 오늘입니다.</div>
        </div>

        <div className="wt-card">
          <h2>어디를 많이 보나</h2>
          <div className="cap">이번 달 열람 수 기준</div>
          <RankBars rows={catRows} unit="회" />
          <div className="wt-note">
            <Link href="/_admin/traffic" style={{ color: "var(--tx-2)" }}>
              앱·웹 나눠 보기 →
            </Link>
          </div>
        </div>
      </section>

      <section className="wt-grid">
        <div className="wt-card">
          <h2>날짜별 API 비용</h2>
          <div className="cap">쓴 만큼 나가는 돈(구글·Gemini)만 · 고정비는 뺐습니다</div>
          <BarChart data={costPoints} highlightLast unit="달러" />
          <BarAxis data={costPoints} />
          <div className="wt-note">
            갑자기 튄 날이 있으면 그날 무엇을 했는지 보세요 —{" "}
            <Link href="/_admin/costs" style={{ color: "var(--tx-2)" }}>
              기능별로 나눠 보기 →
            </Link>
          </div>
        </div>

        <div className="wt-card">
          <h2>이번 달 비용 내역</h2>
          <div className="cap">달러 {rate.toLocaleString("ko-KR")}원 기준</div>
          {costs.length === 0 ? (
            <div className="wt-empty">
              아직 잡힌 비용이 없습니다.
              <br />
              <Link href="/_admin/costs" style={{ color: "var(--tx-2)" }}>
                고정 비용을 먼저 적어 두세요 →
              </Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>항목</th>
                  <th className="wt-num">금액</th>
                </tr>
              </thead>
              <tbody>
                {costs.slice(0, 8).map((c) => (
                  <tr key={`${c.vendor}-${c.label}-${c.source}`}>
                    <td>
                      {c.vendor}
                      <div className="wt-muted" style={{ fontSize: 11 }}>
                        {c.label}
                        {c.calls > 0 && ` · ${c.calls.toLocaleString("ko-KR")}회`}
                      </div>
                    </td>
                    <td className="wt-num">
                      {c.currency === "USD" ? krw(c.amount * rate) : krw(c.amount)}원
                      <div className="wt-muted" style={{ fontSize: 11 }}>
                        {c.source === "metered" ? "쓴 만큼" : c.source === "recurring" ? "고정" : "청구서"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}
