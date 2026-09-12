export type Airline = {
  id: string
  /** 한국어 항공사명 */
  name: string
  /** 영문 항공사명 */
  nameEn: string
  /** IATA 2-letter code — 편명 접두사 및 카드 워터마크로 사용 */
  code: string
  /** 브랜드 액센트 (배지 아이콘 색상으로만 사용) */
  accent: string
}

export const OTHER_AIRLINE_ID = 'other'

export const airlines: Airline[] = [
  { id: 'korean-air', name: '대한항공', nameEn: 'Korean Air', code: 'KE', accent: '#00256C' },
  { id: 'asiana', name: '아시아나항공', nameEn: 'Asiana Airlines', code: 'OZ', accent: '#B3141B' },
  { id: 'jeju-air', name: '제주항공', nameEn: 'Jeju Air', code: '7C', accent: '#F36F21' },
  { id: 'jin-air', name: '진에어', nameEn: 'Jin Air', code: 'LJ', accent: '#0F9B4A' },
  { id: 'tway', name: '티웨이항공', nameEn: "T'way Air", code: 'TW', accent: '#C8102E' },
  { id: OTHER_AIRLINE_ID, name: '기타', nameEn: 'Direct Input', code: '', accent: '#57534E' },
]

export function findAirline(id: string) {
  return airlines.find((airline) => airline.id === id)
}

/**
 * 카드에 표시할 항공사 정보를 해석한다.
 * 기타(직접 입력)인 경우 사용자가 적은 이름과 편명에서 추출한 코드를 사용한다.
 */
export function resolveAirline(airlineId: string, airlineName: string, flightNo: string) {
  const preset = findAirline(airlineId)
  const isOther = !preset || preset.id === OTHER_AIRLINE_ID
  const name = isOther ? airlineName.trim() : preset.name
  const code = isOther ? flightNo.trim().slice(0, 2).toUpperCase() : preset.code

  return {
    name,
    code,
    accent: preset?.accent ?? '#57534E',
  }
}
