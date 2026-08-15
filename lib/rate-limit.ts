import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"

/**
 * AI 라우트 호출량 제한.
 *
 * ⚠️ 이 라우트들은 **인증이 없다.** URL 만 알면 누구나 반복해서 부를 수 있고,
 *    이미지 생성·영수증 인식은 호출당 단가가 높다.
 *    인증을 붙이면 이미 나간 앱(스토어 1.0 + TestFlight)이 전부 죽는다 —
 *    어느 클라이언트도 인증 헤더를 보내지 않는다. 그래서 클라이언트를
 *    안 건드리는 호출량 제한으로 먼저 막는다.
 *
 * 두 겹으로 센다:
 *   - **IP 별**: 한 사람이 계속 때리는 걸 막는다
 *   - **전체**: IP 를 바꿔 가며 때려도 하루 총액이 넘지 않게 한다 (진짜 상한)
 *
 * 카운터는 DB 에 둔다. 람다는 인스턴스마다 메모리가 따로라
 * in-memory 로는 여러 인스턴스에 흩어진 호출을 못 본다.
 */

export type Cost = "cheap" | "image" | "vision"

/** 정상적으로 쓰면 절대 안 닿는 값으로 잡는다. 막자는 건 반복 호출이다. */
const LIMITS: Record<Cost, { perIpHour: number; perDay: number }> = {
  // 글만 다루는 것 — 장소 추출·일정 뽑기·소분류
  cheap: { perIpHour: 60, perDay: 5_000 },
  // 이미지 생성 — 제일 비싸다. 도시 커버는 캐시가 있어 정상 사용은 몇 번뿐이다
  image: { perIpHour: 5, perDay: 100 },
  // 이미지를 읽는 것 — 영수증 인식
  vision: { perIpHour: 30, perDay: 1_000 },
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 프록시를 거치므로 x-forwarded-for 의 맨 앞이 진짜 클라이언트다. */
function ipOf(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? ""
  const first = fwd.split(",")[0]?.trim()
  return first || request.headers.get("x-real-ip") || "unknown"
}

async function bump(bucket: string, ttlSeconds: number): Promise<number | null> {
  const db = getSupabaseAdmin()
  if (!db) return null // 키가 없으면 제한을 걸 수 없다 — 기존 동작 유지
  const { data, error } = await db.rpc("bump_api_counter", {
    p_bucket: bucket,
    p_ttl_seconds: ttlSeconds,
  })
  if (error) {
    // 카운터가 죽었다고 서비스를 멈추진 않는다
    console.warn("[rate-limit] 카운터 실패(무시):", error.message)
    return null
  }
  return typeof data === "number" ? data : null
}

/**
 * 넘었으면 429 응답을, 괜찮으면 null 을 돌려준다.
 *
 *   const limited = await checkRateLimit(request, "image", "trip-cover")
 *   if (limited) return limited
 */
export async function checkRateLimit(
  request: Request,
  cost: Cost,
  route: string
): Promise<NextResponse | null> {
  const limit = LIMITS[cost]
  const day = today()

  const [perIp, perDay] = await Promise.all([
    bump(`ip:${ipOf(request)}:${route}:${day}:${new Date().getUTCHours()}`, 3600),
    bump(`all:${cost}:${day}`, 86_400),
  ])

  if (perIp !== null && perIp > limit.perIpHour) {
    console.warn(`[rate-limit] IP 초과 ${route} ${perIp}/${limit.perIpHour}`)
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": "600" } }
    )
  }

  if (perDay !== null && perDay > limit.perDay) {
    console.error(`[rate-limit] 전체 한도 초과 ${cost} ${perDay}/${limit.perDay}`)
    return NextResponse.json(
      { error: "오늘 사용량이 많아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": "3600" } }
    )
  }

  return null
}
