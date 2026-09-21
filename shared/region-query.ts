import { toEnglishKeywords } from "./city-images"

/** Native geocoders may not understand Korean overseas city names. Keep the original and one known alias. */
export function regionQueries(query: string): string[] {
  const original = query.trim()
  if (!original) return []
  const english = /[가-힣]/.test(original) ? toEnglishKeywords({ city: original }).cityEn : ""
  return [...new Set([original, english].filter(Boolean))]
}

/** A multi-city trip is not one geocodable city. Prefer the city explicitly mentioned by the user. */
export function requestedTripCity(city: string, question: string): string {
  const parts = city.split(/\s*[&＆/·,|]\s*/).map(v => v.trim()).filter(Boolean)
  if (parts.length < 2) return city.trim()
  const text = question.toLowerCase()
  return parts.find(part => regionQueries(part).some(alias => text.includes(alias.toLowerCase()))) ?? parts[0]
}
