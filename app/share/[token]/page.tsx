import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicTripViewer } from "@/components/public-trip-viewer"
import { fetchTripByToken } from "@/lib/templates-api"

/**
 * 카톡 공유 뷰어 — 토큰 링크로만 들어온다.
 * ⚠️ 사적인 링크라 검색엔진에는 안 잡히게 한다(noindex).
 * ⚠️ 복제 버튼은 없다 — 복제는 공개 발행한 템플릿만.
 */
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const trip = await fetchTripByToken(token)
  return {
    title: trip ? `${trip.title} | 위드트립` : "공유된 일정 | 위드트립",
    description: trip
      ? `${[trip.city, trip.duration].filter(Boolean).join(" · ")} — 일정 ${trip.stopCount}곳`
      : "위드트립에서 공유된 여행 일정",
    robots: { index: false, follow: false },
  }
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const trip = await fetchTripByToken(token)
  if (!trip) notFound()
  return <PublicTripViewer trip={trip} mode="share" />
}
