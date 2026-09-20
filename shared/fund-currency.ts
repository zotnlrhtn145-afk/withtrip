import { currencyOfCountry } from "./fx"
import { guessDestination } from "./trip-destination-guess"

export function fundCurrency(trip: { country_code?: string | null; location?: string | null; city?: string | null; title?: string | null } | null): string {
  return currencyOfCountry(trip?.country_code) ?? currencyOfCountry(guessDestination(trip?.location || trip?.city, trip?.title).countryCode) ?? "KRW"
}
/** 공동 자금은 카드 결제가 아니므로 해외 카드 수수료를 더하지 않습니다. */
export function fundKrw(input: string, rate: number | null): number | null {
  const raw = input.trim().replace(/,/g, "")
  if (!raw) return 0
  if (!/^\d+(?:\.\d{0,6})?$/.test(raw) || rate == null || !Number.isFinite(rate) || rate <= 0) return null
  const value = Math.round(Number(raw) * rate)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}
export function fundInput(krw: number, rate: number): string {
  return krw > 0 ? String(Number((krw / rate).toFixed(6))) : ""
}
