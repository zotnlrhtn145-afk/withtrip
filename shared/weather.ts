/**
 * 여행 날짜의 날씨.
 *
 * ## ⚠️ 왜 Open-Meteo 인가
 *
 * 키가 없고 요금이 없다. 일별과 시간별을 **한 번에** 주고 응답이 6KB 다.
 * 다른 날씨 API 는 대부분 키 발급 + 호출 수 제한이 붙는데, 이 기능은 여행
 * 화면을 열 때마다 부르는 것이라 제한이 있으면 금방 막힌다.
 *
 * ## ⚠️ 「그날 있는 곳」의 날씨여야 한다
 *
 * 1일차에 김포에서 제주로 가면 서울 날씨와 제주 날씨가 다르다. 여행 위치
 * 하나로 전부 보여 주면 **틀린 정보**가 된다. 좌표는 부르는 쪽에서 그날
 * 일정을 보고 정해서 넘긴다.
 *
 * ## ⚠️ 예보와 기록을 섞지 않는다
 *
 * 예보는 16일 앞까지만 있다. 그렇다고 먼 여행에 아무것도 안 주면, 정작 짐을
 * 싸고 옷을 고르는 시점에 도움이 없다. 그래서 **지난 몇 해 같은 기간의 실제
 * 기록**을 따로 준다(`fetchClimate`).
 *
 * 다만 **예보인 척하면 안 된다.** 화면에는 반드시 「지난 3년 이맘때」라고
 * 적는다 — "27도래" 와 "예년엔 27도였대" 는 사람이 받아들이는 무게가 다르다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

export type DayWeather = {
  /** `YYYY-MM-DD` */
  date: string
  code: number
  tempMin: number
  tempMax: number
  /** 강수 확률 최대 (%) */
  rain: number
}

export type HourWeather = {
  /** `HH:MM` */
  time: string
  temp: number
  code: number
  rain: number
}

export type WeatherResult = {
  daily: Map<string, DayWeather>
  /** 날짜 → 시간별 */
  hourly: Map<string, HourWeather[]>
}

/**
 * 날씨 코드를 사람 말과 그림으로.
 *
 * ⚠️ 코드가 30가지가 넘는데 다 다르게 보여 줄 필요가 없다. 여행에서 알고
 *    싶은 건 "우산을 챙길까 / 더울까" 지 「이슬비」와 「가벼운 이슬비」의
 *    차이가 아니다. 묶어서 여덟 가지로 줄인다.
 */
export function weatherLook(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "맑음" }
  if (code <= 2) return { icon: "⛅", label: "구름 조금" }
  if (code === 3) return { icon: "☁️", label: "흐림" }
  if (code === 45 || code === 48) return { icon: "🌫️", label: "안개" }
  if (code >= 71 && code <= 77) return { icon: "🌨️", label: "눈" }
  if (code >= 85 && code <= 86) return { icon: "🌨️", label: "눈" }
  if (code >= 95) return { icon: "⛈️", label: "천둥번개" }
  if (code >= 80) return { icon: "🌦️", label: "소나기" }
  if (code >= 51) return { icon: "🌧️", label: "비" }
  return { icon: "⛅", label: "구름" }
}

/**
 * 예보를 볼 수 있는 날인가.
 *
 * ⚠️ 앞으로 16일, 뒤로 90일까지다. 그 밖은 **애초에 부르지 않는다** —
 *    빈 응답을 받으려고 왕복하는 건 낭비다.
 */
export function weatherAvailable(date: string): boolean {
  const d = new Date(`${date}T12:00:00`).getTime()
  if (!Number.isFinite(d)) return false
  const now = Date.now()
  const days = Math.round((d - now) / 86400000)
  return days <= 16 && days >= -90
}

/* ── 캐시 ───────────────────────────────────────────
   ⚠️ 여행 화면은 탭을 옮길 때마다 다시 그려진다. 캐시가 없으면 그때마다
      날씨를 다시 부른다. 날씨는 1시간 안에 크게 안 변하므로 그만큼 아껴 둔다. */
const CACHE_MS = 60 * 60 * 1000
const cache = new Map<string, { at: number; value: WeatherResult }>()

/**
 * 한 곳의 날씨를 기간만큼 받아 온다.
 *
 * ⚠️ 실패해도 **예외를 던지지 않는다.** 날씨는 곁다리다 — 이것 때문에 여행
 *    화면이 안 뜨면 안 된다. 못 받으면 빈 결과를 돌려주고 화면은 날씨 줄만
 *    빼고 그린다.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<WeatherResult> {
  const empty: WeatherResult = { daily: new Map(), hourly: new Map() }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return empty
  if (!weatherAvailable(startDate) && !weatherAvailable(endDate)) return empty

  // 좌표는 소수 둘째 자리까지만 — 100m 차이로 날씨가 달라지지 않는다(캐시 적중률↑)
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${startDate},${endDate}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    timezone: "auto",
    start_date: startDate,
    end_date: endDate,
  })

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${qs.toString()}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return empty
    const j = (await res.json()) as {
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: (number | null)[]
      }
      hourly?: {
        time?: string[]
        temperature_2m?: number[]
        weather_code?: number[]
        precipitation_probability?: (number | null)[]
      }
    }

    const out: WeatherResult = { daily: new Map(), hourly: new Map() }
    const d = j.daily
    for (let i = 0; i < (d?.time?.length ?? 0); i += 1) {
      out.daily.set(d!.time![i], {
        date: d!.time![i],
        code: d!.weather_code?.[i] ?? 0,
        tempMin: Math.round(d!.temperature_2m_min?.[i] ?? 0),
        tempMax: Math.round(d!.temperature_2m_max?.[i] ?? 0),
        rain: Math.round(d!.precipitation_probability_max?.[i] ?? 0),
      })
    }
    const h = j.hourly
    for (let i = 0; i < (h?.time?.length ?? 0); i += 1) {
      const stamp = h!.time![i] // 2026-08-30T09:00
      const date = stamp.slice(0, 10)
      const hh = Number(stamp.slice(11, 13))
      /*
        ⚠️ **세 시간 간격만 남긴다.** 24개를 다 보여 주면 가로로 한참 밀어야
           하고, 여행에서 한 시간 단위까지 볼 일은 드물다. 9·12·15·18시처럼
           낮 시간이 걸리도록 0시부터 3의 배수로 고른다.
      */
      if (hh % 3 !== 0) continue
      const arr = out.hourly.get(date) ?? []
      arr.push({
        time: stamp.slice(11, 16),
        temp: Math.round(h!.temperature_2m?.[i] ?? 0),
        code: h!.weather_code?.[i] ?? 0,
        rain: Math.round(h!.precipitation_probability?.[i] ?? 0),
      })
      out.hourly.set(date, arr)
    }

    cache.set(key, { at: Date.now(), value: out })
    return out
  } catch {
    // 날씨를 못 받아도 여행 화면은 그대로 뜬다
    return empty
  }
}


/* ══ 예보가 없는 먼 여행 ══════════════════════════════

   ⚠️ 예보는 16일 앞까지다. 그런데 **두 달 뒤 여행이야말로 날씨가 궁금하다** —
      짐을 싸고 옷을 고르는 건 그때이기 때문이다. "예보가 없다" 로 끝내면
      정작 필요한 순간에 아무것도 못 준다.

   ⚠️ 그렇다고 **예보인 척하면 안 된다.** 지난 몇 년 같은 기간의 **실제 기록**을
      평균 내서 보여 주고, 화면에는 「지난 3년 이맘때」라고 분명히 적는다.
      "27도래" 와 "예년엔 27도였대" 는 사람이 받아들이는 무게가 다르다.
*/

export type ClimateHint = {
  tempMin: number
  tempMax: number
  /** 비 온 날 수 (하루 1mm 이상) */
  rainyDays: number
  /** 견줘 본 날 수 */
  totalDays: number
  /** 몇 해치를 봤나 */
  years: number
}

const climateCache = new Map<string, { at: number; value: ClimateHint | null }>()
/** 지난 날씨는 안 바뀐다 — 하루쯤 들고 있어도 된다 */
const CLIMATE_CACHE_MS = 24 * 60 * 60 * 1000

function shiftYear(date: string, back: number): string {
  const [y, m, d] = date.split("-").map(Number)
  return `${y - back}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/**
 * 지난 몇 해의 같은 기간이 어땠는지.
 *
 * ⚠️ 해마다 따로 부른다. 3년치를 한 번에 받으면 1,100일치가 와서 응답이
 *    100KB 를 넘는다 — 필요한 건 그중 21일뿐이다.
 * ⚠️ 한 해라도 실패하면 그 해만 빼고 평균 낸다. 전부 실패하면 `null` 이고
 *    화면은 아무것도 안 그린다 — 반쪽짜리 숫자를 보여 주느니 낫다.
 */
export async function fetchClimate(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
  years = 3,
): Promise<ClimateHint | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const key = `${lat.toFixed(1)},${lng.toFixed(1)},${startDate},${endDate}`
  const hit = climateCache.get(key)
  if (hit && Date.now() - hit.at < CLIMATE_CACHE_MS) return hit.value

  let sumMin = 0
  let sumMax = 0
  let days = 0
  let rainy = 0
  let ok = 0

  for (let back = 1; back <= years; back += 1) {
    const qs = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      start_date: shiftYear(startDate, back),
      end_date: shiftYear(endDate, back),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
      timezone: "auto",
    })
    try {
      const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${qs.toString()}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const j = (await res.json()) as {
        daily?: {
          time?: string[]
          temperature_2m_max?: (number | null)[]
          temperature_2m_min?: (number | null)[]
          precipitation_sum?: (number | null)[]
        }
      }
      const d = j.daily
      const n = d?.time?.length ?? 0
      if (n === 0) continue
      for (let i = 0; i < n; i += 1) {
        const hi = d!.temperature_2m_max?.[i]
        const lo = d!.temperature_2m_min?.[i]
        if (hi == null || lo == null) continue
        sumMax += hi
        sumMin += lo
        days += 1
        if ((d!.precipitation_sum?.[i] ?? 0) >= 1) rainy += 1
      }
      ok += 1
    } catch {
      // 이 해는 건너뛴다
    }
  }

  const value: ClimateHint | null =
    days > 0
      ? {
          tempMin: Math.round(sumMin / days),
          tempMax: Math.round(sumMax / days),
          rainyDays: rainy,
          totalDays: days,
          years: ok,
        }
      : null
  climateCache.set(key, { at: Date.now(), value })
  return value
}

/**
 * 「지난 3년 이맘때 25° / 33° · 7일 중 5일 비」
 *
 * ⚠️ **앞에 「지난 N년 이맘때」를 반드시 붙인다.** 이게 빠지면 예보로 읽힌다.
 * ⚠️ 비 온 날은 **하루 이상 있었을 때만** 적는다. "0일 비" 는 읽는 데 방해만 된다.
 */
export function climateSummary(c: ClimateHint): string {
  const per = Math.round(c.totalDays / Math.max(1, c.years))
  const rain =
    c.rainyDays > 0
      ? ` · ${per}일 중 ${Math.round(c.rainyDays / Math.max(1, c.years))}일 비`
      : ""
  return `지난 ${c.years}년 이맘때 ${c.tempMin}° / ${c.tempMax}°${rain}`
}
