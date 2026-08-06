// 여행 목적지의 실제 날씨 — Open-Meteo (무료, API 키 불필요).
// 지오코딩(도시명→좌표) → 현재 날씨(기온+날씨코드)를 가져온다.

export type DestinationWeather = {
  tempC: number
  code: number
  /** 예: "23° 맑음" */
  label: string
  condition: string
}

// WMO weather code → 한국어 상태
function conditionFor(code: number): string {
  if (code === 0) return "맑음"
  if (code === 1 || code === 2) return "구름조금"
  if (code === 3) return "흐림"
  if (code === 45 || code === 48) return "안개"
  if (code >= 51 && code <= 57) return "이슬비"
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "비"
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "눈"
  if (code >= 95) return "뇌우"
  return "구름조금"
}

/** 아이콘 매핑용 키 (컴포넌트에서 lucide 아이콘으로 변환). */
export function weatherIconKey(code: number): "sun" | "cloud-sun" | "cloud" | "cloud-fog" | "cloud-rain" | "cloud-snow" | "cloud-lightning" {
  if (code === 0) return "sun"
  if (code === 1 || code === 2) return "cloud-sun"
  if (code === 3) return "cloud"
  if (code === 45 || code === 48) return "cloud-fog"
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "cloud-rain"
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "cloud-snow"
  if (code >= 95) return "cloud-lightning"
  return "cloud-sun"
}

// 주요 도시 한글→영문 (Open-Meteo 지오코딩이 영문에서 정확) — 없으면 원문 사용.
const CITY_KO_EN: Record<string, string> = {
  서울: "Seoul", 부산: "Busan", 제주: "Jeju", 제주도: "Jeju", 인천: "Incheon",
  대구: "Daegu", 광주: "Gwangju", 대전: "Daejeon", 울산: "Ulsan", 세종: "Sejong",
  수원: "Suwon", 성남: "Seongnam", 고양: "Goyang", 용인: "Yongin", 창원: "Changwon",
  포항: "Pohang", 경주: "Gyeongju", 강릉: "Gangneung", 전주: "Jeonju", 여수: "Yeosu",
  속초: "Sokcho", 춘천: "Chuncheon", 통영: "Tongyeong", 안동: "Andong", 목포: "Mokpo",
  군산: "Gunsan", 남해: "Namhae", 거제: "Geoje", 양양: "Yangyang", 가평: "Gapyeong",
  도쿄: "Tokyo", 오사카: "Osaka", 후쿠오카: "Fukuoka", 삿포로: "Sapporo", 교토: "Kyoto",
  파리: "Paris", 런던: "London", 방콕: "Bangkok", 다낭: "Da Nang", 하노이: "Hanoi",
  세부: "Cebu", 발리: "Bali", 싱가포르: "Singapore", 홍콩: "Hong Kong", 타이베이: "Taipei",
}

export async function fetchDestinationWeather(query: string): Promise<DestinationWeather | null> {
  const raw = query.trim()
  if (!raw) return null
  const q = CITY_KO_EN[raw] ?? raw
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&format=json`
    )
    const geo = (await geoRes.json()) as {
      results?: { latitude: number; longitude: number; population?: number }[]
    }
    const results = geo.results ?? []
    if (results.length === 0) return null
    // 인구가 가장 많은 후보(주요 도시) 우선, 인구 정보 없으면 첫 결과.
    const place =
      results.reduce<(typeof results)[number] | null>((best, r) => {
        if (r.population == null) return best
        if (!best || (best.population ?? 0) < r.population) return r
        return best
      }, null) ?? results[0]

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`
    )
    const wx = (await wxRes.json()) as { current?: { temperature_2m?: number; weather_code?: number } }
    const cur = wx.current
    if (!cur || cur.temperature_2m == null || cur.weather_code == null) return null

    const tempC = Math.round(Number(cur.temperature_2m))
    const code = Number(cur.weather_code)
    const condition = conditionFor(code)
    return { tempC, code, condition, label: `${tempC}° ${condition}` }
  } catch {
    return null
  }
}
