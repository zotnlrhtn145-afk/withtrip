import type { LatLng } from "@/lib/geo"

export type SuggestedAttraction = {
  name: string
  localName: string
  reason: string
  address: string
  imageUrl: string
  rating?: number
  reviewCount?: number
  lat: number
  lng: number
  distanceKm?: number
}

export async function suggestAttractions(input: {
  city: string
  country?: string
  existingNames?: string[]
  accommodation?: LatLng | null
}): Promise<{ results: SuggestedAttraction[]; error?: string }> {
  const city = String(input.city ?? "").trim()
  if (!city) return { results: [], error: "여행지 정보가 없어요." }

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    const response = await fetch("/api/suggest-attractions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city,
        country: input.country ?? "",
        existingNames: input.existingNames ?? [],
        accommodation: input.accommodation ?? null,
      }),
      signal: controller.signal,
    })
    window.clearTimeout(timeout)

    if (!response.ok) return { results: [], error: "추천을 불러오지 못했어요." }
    const json = (await response.json()) as { results?: SuggestedAttraction[]; error?: string }
    return { results: Array.isArray(json.results) ? json.results : [], error: json.error }
  } catch (err) {
    console.error("[suggestAttractions] failed:", err)
    return { results: [], error: "추천을 불러오지 못했어요." }
  }
}
