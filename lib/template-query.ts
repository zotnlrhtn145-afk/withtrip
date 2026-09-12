/** 공개 읽기 전용 쿼리. 기본 허브 요청은 기존 인기 12개 응답을 유지합니다. */
export function parseTemplateQuery(params: URLSearchParams):
  | { kind: "hub" }
  | { kind: "profile"; ownerId: string; page: number }
  | { kind: "detail"; slug: string }
  | { kind: "invalid" } {
  const ownerId = params.get("ownerId"), slug = params.get("slug"), rawPage = params.get("page")
  if (slug != null) {
    if (ownerId != null || rawPage != null || slug.length > 300 || !/^[^\s/\\?#]+-[a-f0-9]{8}$/i.test(slug)) return { kind: "invalid" }
    return { kind: "detail", slug }
  }
  if (ownerId != null) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(ownerId)) return { kind: "invalid" }
    if (rawPage != null && !/^(0|[1-9]\d{0,4})$/.test(rawPage)) return { kind: "invalid" }
    return { kind: "profile", ownerId, page: Number(rawPage ?? 0) }
  }
  return rawPage != null ? { kind: "invalid" } : { kind: "hub" }
}
