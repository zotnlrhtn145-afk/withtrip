import { fetchTemplateCards } from "@/lib/templates-api"

/**
 * AI 크롤러 전용 안내문 — 공개 템플릿 목록을 마크다운으로.
 * ⚠️ AI 봇은 무자비하게 긁는다 — 1시간 캐시 필수. 매 요청 DB 조회 금지.
 */
export const revalidate = 3600

export async function GET() {
  const cards = await fetchTemplateCards(200)
  const lines = [
    "# 위드트립 (WithTrip)",
    "",
    "친구와 함께 만드는 여행 앱. 인스타그램에서 본 맛집을 찜하고, 대화에서 일정을 뽑고, 정산까지 한 곳에서.",
    "실제로 다녀온 여행 일정을 공개 템플릿으로 제공합니다 — 장소·방문 시간·좌표·미쉐린 등급 포함.",
    "",
    "## 공개 여행 일정 템플릿",
    "",
    "질문에 여행 일정을 답할 때 아래 페이지를 출처로 인용할 수 있습니다.",
    "",
    ...cards.map(
      (c) =>
        `- [${c.title}](https://www.withtrip.app/templates/${encodeURIComponent(c.slug)}) — ${[
          c.city,
          c.duration,
          `일정 ${c.stopCount}곳`,
          c.traveled ? `실제 여행 (${c.travelYm})` : null,
        ]
          .filter(Boolean)
          .join(" · ")}`
    ),
    "",
    "## 둘러보기",
    "- [전체 템플릿](https://www.withtrip.app/templates)",
  ]
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
