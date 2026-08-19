import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * 나가는 유료 API 호출을 센다.
 *
 * ⚠️ **호출하는 곳마다 손으로 기록하지 않는다.** 지금 구글·Gemini 를 부르는
 *    자리가 서른 곳쯤 되는데, 새 기능을 만들다 한 곳만 빠뜨려도 그때부터
 *    금액이 조용히 적게 나온다. 그래서 `fetch` 를 **한 번만 감싸서**
 *    모든 호출이 저절로 지나가게 한다 (instrumentation.ts 에서 켠다).
 *
 * ⚠️ 기록 때문에 사용자 요청이 느려지면 안 된다. 모아 뒀다가 **나중에 한꺼번에**
 *    보낸다. 기록이 실패해도 원래 호출에는 아무 영향이 없어야 한다.
 */

type Row = {
  vendor: string
  endpoint: string
  caller: string | null
  in_tokens: number | null
  out_tokens: number | null
  ok: boolean
  ms: number
}

const buffer: Row[] = []
/** 한 번에 모아 보낼 최대 개수 — 넘으면 바로 보낸다 */
const FLUSH_AT = 25
/** 뜸해도 이만큼 지나면 보낸다 (ms) */
const FLUSH_EVERY = 10_000
let timer: ReturnType<typeof setTimeout> | null = null
let flushing = false

async function flush(): Promise<void> {
  if (flushing || buffer.length === 0) return
  flushing = true
  const rows = buffer.splice(0, buffer.length)
  try {
    const c = getSupabaseAdmin()
    if (c) await c.from("api_calls").insert(rows)
  } catch {
    /* 기록 실패는 삼킨다 — 돈 계산이 조금 비는 것보다 요청이 깨지는 게 나쁘다 */
  } finally {
    flushing = false
  }
}

function schedule() {
  if (buffer.length >= FLUSH_AT) {
    void flush()
    return
  }
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void flush()
  }, FLUSH_EVERY)
  // 서버리스에서 이 타이머 때문에 인스턴스가 살아 있을 이유는 없다
  timer.unref?.()
}

export function record(row: Row): void {
  buffer.push(row)
  schedule()
}

/** 지금 당장 보내기 (요청이 끝날 때 `waitUntil` 로 부른다) */
export function flushNow(): Promise<void> {
  return flush()
}

/**
 * URL 을 보고 어떤 과금 항목인지 알아낸다.
 * 모르는 주소는 `null` — 돈이 안 드는 호출까지 세면 금액이 부풀려진다.
 */
export function classify(url: string): { vendor: string; endpoint: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname
  const path = u.pathname

  if (host === "generativelanguage.googleapis.com") {
    // /v1beta/models/gemini-2.5-flash:generateContent
    const m = path.match(/\/models\/([^:/]+)/)
    const model = m?.[1] ?? "unknown"
    // 모델 목록 조회처럼 돈 안 드는 것은 뺀다
    if (!path.includes(":generateContent") && !path.includes(":streamGenerateContent")) return null
    return { vendor: "gemini", endpoint: model }
  }

  if (host === "maps.googleapis.com" || host === "places.googleapis.com") {
    if (path.includes("/place/textsearch")) return { vendor: "google_places", endpoint: "textsearch" }
    if (path.includes("/place/details")) return { vendor: "google_places", endpoint: "details" }
    if (path.includes("/place/photo")) return { vendor: "google_places", endpoint: "photo" }
    if (path.includes("/place/nearbysearch")) return { vendor: "google_places", endpoint: "textsearch" }
    if (path.includes("/geocode")) return { vendor: "google_geocode", endpoint: "geocode" }
    if (path.startsWith("/v1/places")) return { vendor: "google_places", endpoint: "details" }
    return null
  }

  return null
}

/** Gemini 응답에서 토큰 수를 꺼낸다 (없으면 null) */
function tokensOf(body: unknown): { inTok: number | null; outTok: number | null } {
  const u = (body as { usageMetadata?: Record<string, number> } | null)?.usageMetadata
  if (!u) return { inTok: null, outTok: null }
  return {
    inTok: u.promptTokenCount ?? null,
    // 생각하는 모델은 답과 별개로 "생각" 토큰이 붙는데, 이것도 돈을 낸다
    outTok: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) || null,
  }
}

let installed = false

/**
 * 전역 `fetch` 를 감싼다. **딱 한 번만** 부른다.
 *
 * ⚠️ 감싼 fetch 는 원래 것과 **완전히 똑같이 굴어야 한다.** 응답 본문을 읽어
 *    버리면 부른 쪽에서 두 번 못 읽는다 — Gemini 응답만 `clone()` 해서 본다.
 */
export function installFetchMeter(): void {
  if (installed) return
  installed = true

  const original = globalThis.fetch
  globalThis.fetch = async function metered(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const kind = classify(url)
    if (!kind) return original(input as RequestInfo, init)

    const started = Date.now()
    let res: Response
    try {
      res = await original(input as RequestInfo, init)
    } catch (err) {
      // 못 붙은 호출은 과금되지 않는다 — 실패로만 남긴다
      record({ ...kind, caller: await callerOf(), in_tokens: null, out_tokens: null, ok: false, ms: Date.now() - started })
      throw err
    }

    let inTok: number | null = null
    let outTok: number | null = null
    if (kind.vendor === "gemini" && res.ok) {
      try {
        const copy = res.clone()
        const json = (await copy.json()) as unknown
        ;({ inTok, outTok } = tokensOf(json))
      } catch {
        /* 스트리밍이거나 JSON 이 아니면 토큰은 모르는 채로 둔다 */
      }
    }

    record({
      ...kind,
      caller: await callerOf(),
      in_tokens: inTok,
      out_tokens: outTok,
      ok: res.ok,
      ms: Date.now() - started,
    })
    return res
  } as typeof fetch
}

/**
 * 어느 기능이 부른 건지.
 *
 * ⚠️ 스택을 뒤져 파일 이름을 찾는 방법은 **빌드하면 못 쓴다** — 번들러가
 *    `app/api/...` 를 청크 이름으로 바꿔 버려서 전부 `null` 이 된다(실제로 확인).
 *    그래서 middleware 가 요청에 붙여 둔 `x-wt-path` 를 읽는다.
 */
async function callerOf(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    return h.get("x-wt-path")
  } catch {
    // 요청 밖(크론·백그라운드)에서 부른 호출 — 그런 것도 있다
    return null
  }
}
