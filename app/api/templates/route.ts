import { NextResponse } from "next/server"
import { fetchProfileTemplatePage, fetchTemplateBySlug, fetchTemplateCards } from "@/lib/templates-api"
import { parseTemplateQuery } from "@/lib/template-query"

/** 기존 허브 12개 / 프로필 페이지 / 공개 상세. 모두 기존 공개 스크러빙과 1시간 캐시를 사용합니다. */
export const revalidate = 3600
const headers = { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" }
export async function GET(request: Request) {
  const query = parseTemplateQuery(new URL(request.url).searchParams)
  if (query.kind === "invalid") return NextResponse.json({ error: "잘못된 여행 조회 요청이에요." }, { status: 400 })
  if (query.kind === "profile") return NextResponse.json(await fetchProfileTemplatePage(query.ownerId, query.page), { headers })
  if (query.kind === "detail") {
    const trip = await fetchTemplateBySlug(query.slug)
    return trip ? NextResponse.json({ trip }, { headers }) : NextResponse.json({ error: "공개한 여행을 찾을 수 없어요." }, { status: 404, headers })
  }
  return NextResponse.json({ cards: await fetchTemplateCards(12) }, { headers })
}
