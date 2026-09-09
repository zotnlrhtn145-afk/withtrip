import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicTripViewer } from "@/components/public-trip-viewer"
import { CityHub } from "@/components/templates-hub"
import { fetchCityCards, fetchTemplateBySlug, type PublicTrip } from "@/lib/templates-api"
import { slugIdPart } from "@/shared/trip-templates"

/**
 * /templates/도쿄-3박4일-미쉐린-a1b2c3d4  → 템플릿 상세
 * /templates/도쿄                          → 도시 허브 (같은 자리에서 가른다)
 *
 * 슬러그 끝에 id 8자가 있으면 상세, 없으면 도시 이름으로 본다.
 * 검색 봇이 "도쿄 여행 일정" 로 꽂히는 자리가 도시 허브다.
 */
export const revalidate = 3600

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const decoded = decodeURIComponent(slug)

  if (!slugIdPart(decoded)) {
    return {
      title: `${decoded} 여행 일정 템플릿 | 위드트립`,
      description: `${decoded} 여행 일정을 원클릭으로 복제해 내 여행으로 만드세요. 장소·시간·길찾기가 다 들어 있어요.`,
    }
  }

  const trip = await fetchTemplateBySlug(decoded)
  if (!trip) return { title: "여행 템플릿 | 위드트립" }
  const themeText = trip.themes.map((t) => t.label).join(" · ")
  return {
    title: `${trip.title} — ${[trip.city, trip.duration].filter(Boolean).join(" ")} | 위드트립`,
    description:
      trip.description ??
      `${[trip.city, trip.duration, themeText].filter(Boolean).join(" · ")} — 일정 ${trip.stopCount}곳. 복제해서 바로 시작하세요.`,
  }
}

/** 구글 리치 결과·AI 인용 재료 — 일정을 기계용 언어로 한 번 더 적는다 */
function jsonLd(trip: PublicTrip) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: trip.title,
    description: trip.description ?? undefined,
    touristType: trip.themes.map((t) => t.label),
    itinerary: {
      "@type": "ItemList",
      numberOfItems: trip.stopCount,
      itemListElement: trip.days.flatMap((d) =>
        d.stops.map((s, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "TouristAttraction",
            name: s.placeName,
            address: s.address ?? undefined,
            geo:
              s.lat != null && s.lng != null
                ? { "@type": "GeoCoordinates", latitude: s.lat, longitude: s.lng }
                : undefined,
          },
        }))
      ),
    },
  }
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const decoded = decodeURIComponent(slug)

  // id 조각이 없으면 도시 허브
  if (!slugIdPart(decoded)) {
    const cards = await fetchCityCards(decoded)
    if (cards.length === 0) notFound()
    return <CityHub city={decoded} cards={cards} />
  }

  const trip = await fetchTemplateBySlug(decoded)
  if (!trip) notFound()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(trip)) }} />
      <PublicTripViewer trip={trip} mode="template" />
    </>
  )
}
