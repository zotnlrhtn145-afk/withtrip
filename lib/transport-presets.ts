import type { SearchableOption } from "@/components/searchable-select"

/** 검색형 열차 종류 프리셋 (한글명 = value) */
export const TRAIN_PRESETS: SearchableOption[] = [
  { value: "KTX", label: "KTX", description: "고속철도" },
  { value: "SRT", label: "SRT", description: "수서고속철도" },
  { value: "ITX-새마을", label: "ITX-새마을", description: "일반철도" },
  { value: "ITX-청춘", label: "ITX-청춘", description: "일반철도" },
  { value: "무궁화호", label: "무궁화호", description: "일반철도" },
  { value: "누리로", label: "누리로", description: "일반철도" },
  { value: "신칸센", label: "신칸센", description: "Shinkansen · 일본" },
  { value: "유레일", label: "유레일", description: "Eurail · 유럽" },
  { value: "고속버스", label: "고속버스", description: "고속/시외버스" },
]

/** 검색형 주요 역 프리셋 — 목록에 없으면 직접 입력. */
export const STATION_OPTIONS: SearchableOption[] = [
  { value: "서울역", label: "서울역", description: "KTX·SRT" },
  { value: "용산역", label: "용산역", description: "KTX" },
  { value: "수서역", label: "수서역", description: "SRT" },
  { value: "부산역", label: "부산역", description: "KTX·SRT" },
  { value: "동대구역", label: "동대구역", description: "KTX·SRT" },
  { value: "광명역", label: "광명역", description: "KTX" },
  { value: "오송역", label: "오송역", description: "KTX" },
  { value: "천안아산역", label: "천안아산역", description: "KTX" },
  { value: "대전역", label: "대전역", description: "KTX·SRT" },
  { value: "익산역", label: "익산역", description: "KTX·SRT" },
  { value: "광주송정역", label: "광주송정역", description: "KTX·SRT" },
  { value: "여수엑스포역", label: "여수엑스포역", description: "KTX" },
  { value: "포항역", label: "포항역", description: "KTX" },
  { value: "강릉역", label: "강릉역", description: "KTX" },
  { value: "청량리역", label: "청량리역", description: "ITX-청춘" },
]
