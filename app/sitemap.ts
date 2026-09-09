import type { MetadataRoute } from "next"

import { fetchTemplateCards } from "@/lib/templates-api"

/**
 * 공개 템플릿 전부 + 템플릿 3개 이상인 도시 허브.
 * ⚠️ 여기 없는 페이지는 색인이 안 된다 — SSR 만 하고 이걸 빼먹으면 헛일이다.
 */
export const revalidate = 3600

const BASE = "https://www.withtrip.co.kr"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cards = await fetchTemplateCards(500)

  const cities = new Map<string, number>()
  for (const c of cards) if (c.city) cities.set(c.city, (cities.get(c.city) ?? 0) + 1)

  return [
    { url: `${BASE}/templates`, changeFrequency: "daily", priority: 0.9 },
    ...[...cities.entries()]
      .filter(([, n]) => n >= 3)
      .map(([city]) => ({
        url: `${BASE}/templates/${encodeURIComponent(city)}`,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ...cards.map((c) => ({
      url: `${BASE}/templates/${encodeURIComponent(c.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ]
}
