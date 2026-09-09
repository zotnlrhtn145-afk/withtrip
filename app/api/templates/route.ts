import { NextResponse } from "next/server"

import { fetchTemplateCards } from "@/lib/templates-api"

/** 홈 「인기 템플릿」 줄이 쓴다 — 1시간 캐시, 공개 필드만 */
export const revalidate = 3600

export async function GET() {
  const cards = await fetchTemplateCards(12)
  return NextResponse.json(
    { cards },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" } }
  )
}
