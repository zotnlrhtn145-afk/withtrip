import type { Metadata } from "next"

import { TemplatesHub } from "@/components/templates-hub"
import { fetchTemplateCards } from "@/lib/templates-api"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "여행 일정 템플릿 — 복제해서 시작하세요 | 위드트립",
  description:
    "도쿄·오사카·제주·다낭… 실제로 다녀온 여행 일정을 원클릭으로 복제하세요. 장소·시간·길찾기·미쉐린 정보까지 다 들어 있어요.",
}

export default async function TemplatesPage() {
  const cards = await fetchTemplateCards()
  return <TemplatesHub cards={cards} />
}
