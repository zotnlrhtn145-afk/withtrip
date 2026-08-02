/**
 * 정규식으로 못 잡는 경우(유명 체인점 등)를 Gemini 상식으로 보정한다.
 * 실패해도 null만 반환 — 호출부는 기존 추정값을 그대로 유지하면 된다.
 */
export async function classifySubCategory(input: {
  kind: "restaurant" | "bar" | "stay"
  placeName: string
  localName?: string
  address?: string
}): Promise<string | null> {
  if (!input.placeName.trim()) return null

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 20_000)
    const response = await fetch("/api/classify-subcategory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    })
    window.clearTimeout(timeout)
    if (!response.ok) return null
    const json = (await response.json()) as { subCategory?: string | null }
    return json.subCategory?.trim() || null
  } catch {
    return null
  }
}
