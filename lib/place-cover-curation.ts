/**
 * 후보 사진(Google Places) 중 업장 내부/음식 사진을 AI가 골라 대표 이미지로 승격한다.
 * 저장은 이미 끝난 뒤 백그라운드에서 호출되므로, 실패해도 기존 대표 이미지가 유지된다.
 */
export async function curatePlaceCoverImage(input: {
  photoUrls: string[]
  placeName?: string
  kind?: string
  subCategory?: string
}): Promise<string | null> {
  const photoUrls = input.photoUrls.filter(Boolean)
  if (photoUrls.length < 2) return null

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 60_000)
    const response = await fetch("/api/curate-place-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoUrls,
        placeName: input.placeName,
        kind: input.kind,
        subCategory: input.subCategory,
      }),
      signal: controller.signal,
    })
    window.clearTimeout(timeout)
    if (!response.ok) return null
    const json = (await response.json()) as { imageUrl?: string | null }
    return json.imageUrl?.trim() || null
  } catch (err) {
    console.warn("[curatePlaceCoverImage] skipped:", err)
    return null
  }
}
