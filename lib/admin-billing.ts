import "server-only"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * "실제로 얼마 나갔나"를 모으는 곳.
 *
 * ⚠️ 먼저 알아 둘 것: **지출액을 API 로 알려주는 업체가 거의 없다.**
 *    - Vercel 공개 API 에는 billing 경로 자체가 없다.
 *    - Supabase Management API 는 addons(요금제 부가항목)까지만 준다.
 *    - 구글은 BigQuery 청구서 내보내기를 켜야만 실제 청구액이 나온다.
 *
 *    그래서 "자동"을 이렇게 나눈다.
 *    - **쓴 만큼 나가는 돈** → 우리가 호출을 직접 세고 단가를 곱한다 (api_calls).
 *      열쇠가 필요 없고, 무엇보다 **어느 기능이 돈을 먹는지** 보인다.
 *    - **매달 똑같이 나가는 돈** → 한 번 적으면 다음 달부터 저절로 붙는다.
 *    - **청구서 실제값** → BigQuery 를 켜거나 손으로 적으면 위 추정치를 덮는다.
 */

function db() {
  const c = getSupabaseAdmin()
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 없습니다")
  return c
}

export type MonthCost = {
  vendor: string
  label: string
  amount: number
  currency: string
  /** "metered"(우리가 셈) | "recurring"(고정) | "invoice"(청구서) | "manual" */
  source: string
  calls: number
}

export async function fetchMonthCosts(month: string): Promise<MonthCost[]> {
  const { data, error } = await db().rpc("admin_month_costs", { p_month: month })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    vendor: r.vendor as string,
    label: r.label as string,
    amount: Number(r.amount ?? 0),
    currency: r.currency as string,
    source: r.source as string,
    calls: Number(r.calls ?? 0),
  }))
}

export type DailyApiCost = { day: string; vendor: string; calls: number; usd: number }

export async function fetchDailyApiCost(from: string, to: string): Promise<DailyApiCost[]> {
  const { data, error } = await db().rpc("admin_daily_api_cost", { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    day: r.day as string,
    vendor: r.vendor as string,
    calls: Number(r.calls ?? 0),
    usd: Number(r.usd ?? 0),
  }))
}

export type CallerCost = { caller: string; calls: number; usd: number }

export async function fetchCostByCaller(from: string, to: string): Promise<CallerCost[]> {
  const { data, error } = await db().rpc("admin_cost_by_caller", { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    caller: r.caller as string,
    calls: Number(r.calls ?? 0),
    usd: Number(r.usd ?? 0),
  }))
}

export type Recurring = {
  id: string
  vendor: string
  label: string
  amount: number
  currency: string
  started_on: string
  ended_on: string | null
}

export async function fetchRecurring(): Promise<Recurring[]> {
  const { data } = await db().from("admin_recurring").select("*").order("amount", { ascending: false })
  return (data ?? []) as Recurring[]
}

/**
 * 달러를 원으로.
 *
 * ⚠️ 환율은 **그날 값을 저장해 둔다.** 매번 새로 물어보면 지난달 금액이
 *    오늘 환율로 바뀌어서, 어제 본 숫자와 오늘 본 숫자가 달라진다.
 */
export async function usdKrw(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const c = db()

  const { data: saved } = await c.from("fx_rates").select("usd_krw").eq("on_date", today).maybeSingle()
  if (saved?.usd_krw) return Number(saved.usd_krw)

  try {
    // 열쇠가 필요 없는 공개 환율 (유럽중앙은행 값)
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", {
      next: { revalidate: 3600 },
    })
    const json = (await res.json()) as { rates?: { KRW?: number } }
    const rate = json.rates?.KRW
    if (rate) {
      await c.from("fx_rates").upsert({ on_date: today, usd_krw: rate })
      return rate
    }
  } catch {
    /* 못 가져오면 마지막으로 알던 값을 쓴다 */
  }

  const { data: last } = await c
    .from("fx_rates")
    .select("usd_krw")
    .order("on_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return Number(last?.usd_krw ?? 1380)
}

/**
 * Supabase 요금제에서 지금 켜 둔 부가항목 (실제 청구의 큰 덩어리).
 * 토큰이 없으면 `null` — 화면에서 "연결 안 됨"으로 보여 준다.
 */
export type SupabaseAddons = { name: string; variant: string; price: number | null }[]

export async function fetchSupabaseAddons(): Promise<SupabaseAddons | null> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const ref = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  if (!token || !ref) return null

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/billing/addons`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      selected_addons?: { type?: string; variant?: { name?: string; identifier?: string; price?: number } }[]
    }
    return (json.selected_addons ?? []).map((a) => ({
      name: a.type ?? "addon",
      variant: a.variant?.name ?? a.variant?.identifier ?? "-",
      price: a.variant?.price ?? null,
    }))
  } catch {
    return null
  }
}

/** 어떤 업체가 자동으로 붙어 있고 어떤 게 손이 필요한지 */
export function connectionStatus() {
  return [
    {
      vendor: "구글 (Places · Gemini)",
      how: "우리가 호출을 직접 셈",
      connected: true,
      note: "쓴 만큼 계산합니다. 실제 청구서와 맞춰 보려면 BigQuery 청구서 내보내기를 켜세요.",
    },
    {
      vendor: "Supabase",
      how: "Management API",
      connected: Boolean(process.env.SUPABASE_ACCESS_TOKEN),
      note: process.env.SUPABASE_ACCESS_TOKEN
        ? "요금제 부가항목을 읽어 옵니다."
        : "SUPABASE_ACCESS_TOKEN 을 넣으면 요금제를 자동으로 읽습니다.",
    },
    {
      vendor: "Vercel",
      how: "고정 요금",
      connected: false,
      note: "Vercel 은 청구액 API 를 공개하지 않습니다 — 아래 '매달 고정'에 한 번 적으면 다음 달부터 자동입니다.",
    },
    {
      vendor: "EAS · 애플 · 구글플레이",
      how: "고정 요금",
      connected: false,
      note: "청구액 API 가 없습니다 — '매달 고정'에 한 번만 적어 두세요.",
    },
  ]
}

/**
 * 검색 캐시가 막아 준 구글 호출 — 곧 아낀 돈.
 *
 * 이 숫자를 보여 주는 이유: 캐시는 **잘 돌면 아무 일도 안 일어난 것처럼 보인다.**
 * 얼마를 아꼈는지 눈에 보여야 수명을 늘릴지 줄일지 판단할 수 있다.
 */
export async function fetchSearchSavings(
  from: string,
  to: string
): Promise<{ hits: number; entries: number; usd: number }> {
  const c = db()
  const { data } = await c.rpc("admin_search_cache_savings", { p_from: from, p_to: to })
  const row = (data ?? [])[0] as { hits?: number; entries?: number } | undefined
  const hits = Number(row?.hits ?? 0)

  // 막아 준 호출 수 × Text Search 단가
  const { data: price } = await c
    .from("api_prices")
    .select("usd_per_1k")
    .eq("vendor", "google_places")
    .eq("endpoint", "textsearch")
    .order("from_date", { ascending: false })
    .limit(1)
    .maybeSingle()

  const per1k = Number(price?.usd_per_1k ?? 32)
  return { hits, entries: Number(row?.entries ?? 0), usd: (hits / 1000) * per1k }
}


/**
 * 실시간(Realtime) 사용량.
 *
 * 무료 한도는 **월 200만 건**인데, 넘기기 전까지는 아무 신호가 없다.
 * 청구서를 보고 아는 대신 미리 보이게 한다.
 *
 * ⚠️ 여기 세는 건 **DB 가 직접 쏜 신호**다. 대화방을 열어 둔 동안 오가는
 *    변경 알림(postgres_changes)은 안 잡힌다 — 화면에도 그렇게 적어 둔다.
 */
export async function fetchRealtimeUsage(): Promise<{
  thisMonth: number
  last24h: number
  limit: number
  daily: { day: string; n: number }[]
}> {
  const { data } = await db().rpc("admin_realtime_usage")
  const o = (data ?? {}) as {
    this_month?: number
    last_24h?: number
    free_limit?: number
    daily?: { day: string; n: number }[]
  }
  return {
    thisMonth: Number(o.this_month ?? 0),
    last24h: Number(o.last_24h ?? 0),
    limit: Number(o.free_limit ?? 2_000_000),
    daily: Array.isArray(o.daily) ? o.daily : [],
  }
}
