/** Preserve legacy reasons without inventing a second explanation. */
export function placeRecommendationCopy(input: { highlight?: unknown; reason?: unknown }) {
  const reason = typeof input.reason === "string" ? input.reason.trim() : ""
  const raw = typeof input.highlight === "string" ? input.highlight.replace(/\*\*/g, "").trim() : ""
  const comparable = (s: string) => s.normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "").toLowerCase()
  // A highlight must be brief and add a distinct summary, never duplicate all detail.
  const highlight = raw.length <= 40 && reason && comparable(raw) !== comparable(reason) ? raw : ""
  return { highlight, reason }
}
