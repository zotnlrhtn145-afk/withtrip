import Link from "next/link"

import {
  connectionStatus,
  fetchCostByCaller,
  fetchDailyApiCost,
  fetchMonthCosts,
  fetchRealtimeUsage,
  fetchRecurring,
  fetchSearchSavings,
  fetchSupabaseAddons,
  usdKrw,
} from "@/lib/admin-billing"

import { addRecurringAction, endRecurringAction, setActualCostAction } from "../actions"
import { BarAxis, BarChart, RankBars } from "../charts"
import { dayList, krw, monthOf, recentMonths, seoulToday, usd } from "../format"

export const dynamic = "force-dynamic"

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
  const sp = await searchParams
  const today = seoulToday()
  const months = recentMonths(6)
  const month = sp.m && months.includes(sp.m) ? sp.m : monthOf(today)
  const isThisMonth = month === monthOf(today)

  const monthEnd = isThisMonth
    ? today
    : new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10)
  const days = dayList(month, monthEnd)

  const [costs, recurring, apiCost, byCaller, addons, rate] = await Promise.all([
    fetchMonthCosts(month).catch(() => []),
    fetchRecurring().catch(() => []),
    fetchDailyApiCost(month, monthEnd).catch(() => []),
    fetchCostByCaller(month, monthEnd).catch(() => []),
    fetchSupabaseAddons().catch(() => null),
    usdKrw().catch(() => 1380),
  ])
  const savings = await fetchSearchSavings(month, monthEnd).catch(() => ({ hits: 0, entries: 0, usd: 0 }))
  const realtime = await fetchRealtimeUsage().catch(() => ({
    thisMonth: 0,
    last24h: 0,
    limit: 2_000_000,
    daily: [] as { day: string; n: number }[],
  }))
  /* 이번 달이 아직 안 끝났으면, 이 속도로 가면 월말에 얼마일지로 본다 */
  const rtDay = Number(today.slice(8, 10))
  const rtProjected = isThisMonth && rtDay > 0 ? Math.round((realtime.thisMonth / rtDay) * 30) : realtime.thisMonth
  const rtPct = Math.min(100, (rtProjected / realtime.limit) * 100)

  const toKrw = (amount: number, currency: string) => (currency === "USD" ? amount * rate : amount)
  const totalKrw = costs.reduce((s, c) => s + toKrw(c.amount, c.currency), 0)
  const meteredKrw = costs.filter((c) => c.source === "metered").reduce((s, c) => s + toKrw(c.amount, c.currency), 0)
  const fixedKrw = totalKrw - meteredKrw

  const costByDay = new Map<string, number>()
  for (const r of apiCost) costByDay.set(r.day, (costByDay.get(r.day) ?? 0) + r.usd)
  const points = days.map((d) => ({
    label: String(Number(d.slice(8, 10))),
    value: Number((costByDay.get(d) ?? 0).toFixed(4)),
    sub: `${krw((costByDay.get(d) ?? 0) * rate)}원`,
  }))

  const conn = connectionStatus()

  return (
    <>
      <div className="wt-top">
        <div>
          <h1>비용·과금</h1>
          <div className="wt-sub">실제로 나가는 돈 · 달러 {rate.toLocaleString("ko-KR")}원 기준</div>
        </div>
        <div className="wt-seg">
          {months.map((m) => (
            <Link key={m} href={`/_admin/costs?m=${m}`} className={m === month ? "on" : ""}>
              {Number(m.slice(5, 7))}월
            </Link>
          ))}
        </div>
      </div>

      <section className="wt-tiles">
        <div className="wt-tile accent">
          <div className="k">{Number(month.slice(5, 7))}월 합계</div>
          <div className="v">
            {krw(totalKrw)}
            <small>원</small>
          </div>
          <div className="d">{usd(totalKrw / rate)}</div>
        </div>
        <div className="wt-tile">
          <div className="k">쓴 만큼 (구글·Gemini)</div>
          <div className="v">
            {krw(meteredKrw)}
            <small>원</small>
          </div>
          <div className="d">호출을 직접 세어 계산한 값입니다</div>
        </div>
        <div className="wt-tile">
          <div className="k">매달 고정</div>
          <div className="v">
            {krw(fixedKrw)}
            <small>원</small>
          </div>
          <div className="d">요금제·서버·계정 유지비</div>
        </div>
        <div className="wt-tile">
          <div className="k">API 호출</div>
          <div className="v">{apiCost.reduce((s, r) => s + r.calls, 0).toLocaleString("ko-KR")}</div>
          <div className="d">이번 달 바깥으로 나간 유료 호출 수</div>
        </div>
        {/*
          캐시는 잘 돌면 아무 일도 안 일어난 것처럼 보인다 —
          얼마를 아꼈는지 보여야 수명을 늘릴지 줄일지 판단할 수 있다.
        */}
        <div className="wt-tile">
          <div className="k">검색 캐시로 아낀 돈</div>
          <div className="v" style={{ color: "var(--good)" }}>
            {krw(savings.usd * rate)}
            <small>원</small>
          </div>
          <div className="d">
            같은 검색 {savings.hits.toLocaleString("ko-KR")}번을 구글에 안 물었습니다
          </div>
        </div>
        {/*
          ⚠️ 실시간은 **넘기기 전까지 아무 신호가 없다.** 넘긴 다음 달 청구서로
             알게 되는 종류라, 지금 속도로 가면 월말에 얼마일지를 같이 보여 준다.
        */}
        <div className="wt-tile">
          <div className="k">실시간 신호</div>
          <div
            className="v"
            style={{ color: rtPct >= 80 ? "var(--crit)" : rtPct >= 50 ? "var(--warn)" : "var(--good)" }}
          >
            {rtPct < 1 ? "<1" : Math.round(rtPct)}
            <small>%</small>
          </div>
          <div className="d">
            이번 달 {realtime.thisMonth.toLocaleString("ko-KR")}건
            {isThisMonth && ` · 이 속도면 월말 ${rtProjected.toLocaleString("ko-KR")}건`}
            <br />
            무료는 월 {(realtime.limit / 10000).toLocaleString("ko-KR")}만 건까지 · 대화방을 열어 둔 동안
            오가는 건 여기 안 잡힙니다
          </div>
        </div>
      </section>

      <section className="wt-grid">
        <div className="wt-card">
          <h2>날짜별 API 비용</h2>
          <div className="cap">쓴 만큼 나가는 돈만 · 고정비는 뺐습니다</div>
          <BarChart data={points} highlightLast={isThisMonth} unit="달러" />
          <BarAxis data={points} />
        </div>

        <div className="wt-card">
          <h2>어느 기능이 돈을 먹나</h2>
          <div className="cap">이번 달 · 달러</div>
          <RankBars rows={byCaller.slice(0, 8).map((c) => ({ label: c.caller, value: c.usd }))} unit="$" />
          <div className="wt-note">
            여기 위쪽에 있는 것부터 캐시를 걸면 돈이 가장 많이 줄어듭니다.
          </div>
        </div>
      </section>

      <section className="wt-card" style={{ marginBottom: 12 }}>
        <h2>비용 내역</h2>
        <div className="cap">
          &lsquo;쓴 만큼&rsquo;은 우리가 센 호출 수 × 공개 단가입니다. 청구서 실제 금액을 적으면 그 값이 우선합니다.
        </div>
        <div className="wt-scroll">
          <table>
            <thead>
              <tr>
                <th>업체</th>
                <th>항목</th>
                <th>계산 방식</th>
                <th className="wt-num">호출</th>
                <th className="wt-num">달러</th>
                <th className="wt-num">원</th>
              </tr>
            </thead>
            <tbody>
              {costs.length === 0 && (
                <tr>
                  <td colSpan={6} className="wt-empty">
                    이 달에 잡힌 비용이 없습니다.
                  </td>
                </tr>
              )}
              {costs.map((c) => (
                <tr key={`${c.vendor}-${c.label}-${c.source}`}>
                  <td>{c.vendor}</td>
                  <td className="wt-muted">{c.label}</td>
                  <td>
                    <span className={`wt-chip ${c.source === "invoice" ? "ok" : "nt"}`}>
                      {c.source === "metered" ? "쓴 만큼" : c.source === "recurring" ? "고정" : "청구서"}
                    </span>
                  </td>
                  <td className="wt-num wt-muted">{c.calls ? c.calls.toLocaleString("ko-KR") : "-"}</td>
                  <td className="wt-num">{c.currency === "USD" ? usd(c.amount) : "-"}</td>
                  <td className="wt-num">{krw(toKrw(c.amount, c.currency))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wt-split">
        <div className="wt-card">
          <h2>매달 고정으로 나가는 돈</h2>
          <div className="cap">
            한 번만 적으면 <b>다음 달부터 저절로</b> 합계에 들어갑니다. 해지하면 &lsquo;끊기&rsquo;를 누르세요.
          </div>
          <table>
            <thead>
              <tr>
                <th>업체</th>
                <th>항목</th>
                <th className="wt-num">금액</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {recurring.length === 0 && (
                <tr>
                  <td colSpan={4} className="wt-empty">
                    아직 없습니다 — 아래에서 추가하세요.
                  </td>
                </tr>
              )}
              {recurring.map((r) => (
                <tr key={r.id} style={r.ended_on ? { opacity: 0.5 } : undefined}>
                  <td>{r.vendor}</td>
                  <td className="wt-muted">{r.label}</td>
                  <td className="wt-num">
                    {r.currency === "USD" ? usd(r.amount) : `${krw(r.amount)}원`}
                  </td>
                  <td className="wt-num">
                    {r.ended_on ? (
                      <span className="wt-muted" style={{ fontSize: 11 }}>
                        {r.ended_on} 끊김
                      </span>
                    ) : (
                      <form action={endRecurringAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="wt-btn" type="submit">
                          끊기
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            action={addRecurringAction}
            style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 84px 76px 56px", gap: 6, marginTop: 12 }}
          >
            <input name="vendor" placeholder="Vercel" aria-label="업체" required />
            <input name="label" placeholder="Pro 요금제" aria-label="항목" required />
            <input name="amount" type="number" step="0.01" placeholder="20" aria-label="금액" required />
            <select name="currency" aria-label="통화" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </select>
            <button className="wt-btn pr" type="submit">
              추가
            </button>
          </form>
        </div>

        <div className="wt-card">
          <h2>자동 연결 상태</h2>
          <div className="cap">청구액을 API 로 알려주는 업체는 많지 않습니다 — 아래가 지금 상태입니다</div>
          <table>
            <tbody>
              {conn.map((c) => (
                <tr key={c.vendor}>
                  <td style={{ width: "38%" }}>
                    {c.vendor}
                    <div className="wt-muted" style={{ fontSize: 11 }}>
                      {c.how}
                    </div>
                  </td>
                  <td>
                    <span className={`wt-chip ${c.connected ? "ok" : "wr"}`}>
                      {c.connected ? "자동" : "설정 필요"}
                    </span>
                    <div className="wt-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {c.note}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {addons && addons.length > 0 && (
            <>
              <div className="wt-note" style={{ marginTop: 14, marginBottom: 6, color: "var(--tx-2)" }}>
                Supabase 에서 켜 둔 부가항목
              </div>
              <table>
                <tbody>
                  {addons.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td className="wt-muted">{a.variant}</td>
                      <td className="wt-num">{a.price != null ? usd(a.price) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      <section className="wt-card">
        <h2>청구서에서 본 실제 금액 적기</h2>
        <div className="cap">
          카드 명세서나 업체 청구서 금액을 적으면 <b>추정치 대신 이 값이 합계에 들어갑니다.</b> 같은 달·같은 항목을 다시 적으면 덮어씁니다.
        </div>
        <form
          action={setActualCostAction}
          style={{ display: "grid", gridTemplateColumns: "120px 1fr 1.2fr 92px 76px 56px", gap: 6 }}
        >
          <select name="month" aria-label="달" defaultValue={month}>
            {months.map((m) => (
              <option key={m} value={m}>
                {Number(m.slice(0, 4))}.{Number(m.slice(5, 7))}월
              </option>
            ))}
          </select>
          <input name="vendor" placeholder="google" aria-label="업체" required />
          <input name="label" placeholder="Maps Platform" aria-label="항목" />
          <input name="amount" type="number" step="0.01" placeholder="12.40" aria-label="금액" required />
          <select name="currency" aria-label="통화" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
          <button className="wt-btn pr" type="submit">
            저장
          </button>
        </form>
      </section>
    </>
  )
}
