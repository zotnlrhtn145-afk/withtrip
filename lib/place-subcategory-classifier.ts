import { normalizeSubCategory, type WishlistKind } from "@/shared/place-subcategories"

/**
 * 정규식으로 못 잡는 경우(유명 체인점 등)를 Gemini 상식으로 보정한다.
 * 실패해도 null만 반환 — 호출부는 기존 추정값을 그대로 유지하면 된다.
 */
export async function classifySubCategory(input: {
  /* ⚠️ 셋만 받던 자리다 — 관광지·쇼핑·체험이 여기서 막혀 「기타」로 굳었다 */
  kind: WishlistKind
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
    /* ⚠️ 화면의 칩과 글자가 어긋나면 그 값은 어느 칸에도 안 붙는다 — 한 번 더 맞춘다 */
    const sub = normalizeSubCategory(input.kind, json.subCategory)
    return sub && sub !== "기타" ? sub : null
  } catch {
    return null
  }
}
