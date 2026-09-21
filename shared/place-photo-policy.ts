/** 장소 업종별 대표사진 기준. AI가 사진 내용으로 판단하며 이름만으로 사진을 단정하지 않습니다. */
export function photoFocus(name: string, kind: string, subCategory = ""): "airport" | "food" | "venue" | "stay" | "landmark" {
  const category = `${kind} ${subCategory}`.trim().toLowerCase()
  if (/bar|lounge|night_club|nightclub|라운지|유흥|클럽|술|펍/.test(category)) return "venue"
  if (/stay|lodging|hotel|숙소|호텔/.test(category)) return "stay"
  if (/공항|\bairport\b/i.test(name) && !/카페|cafe|coffee|restaurant|식당|식사/.test(category.replace(/^restaurant$/, ""))) return "airport"
  if (/restaurant|cafe|bakery|food|식사|음식|식당|카페|베이커리|디저트/.test(category)) return "food"
  return "landmark"
}
export function placePhotoPrompt(name: string, kind: string, subCategory: string, count: number): string {
  const focus = photoFocus(name, kind, subCategory)
  const priority = {
    airport: "해당 공항의 넓은 실내 터미널 전경을 선택. 1순위: 출국장·체크인홀. 2순위: 공항임을 알아볼 수 있는 대합실·탑승구 전경. 공항 이름·안내판이 함께 보이면 우선. 외관·면세점·카페·라운지·음식·비행기만 나온 사진은 제외. 다른 공항으로 대체 금지. 적합한 실내 사진이 없으면 -1.",
    food: "1순위: 그 식당·카페의 대표 음식·음료. 2순위: 업장 전체 실내 분위기. 적절한 음식 사진이 있으면 실내보다 우선해라.",
    venue: "1순위: 바·라운지·클럽의 좌석·바 카운터·조명 등 공간과 분위기가 잘 보이는 실내. 2순위: 해당 업장 입구. 칵테일·음식 클로즈업보다 공간을 우선해라.",
    stay: "1순위: 호텔·숙소 건물 전경. 2순위: 객실·로비·수영장. 건물 외관이라는 이유로 제외하지 마라.",
    landmark: "1순위: 해당 장소의 전체 모습·대표 풍경. 2순위: 장소 특징이 드러나는 가까운 사진. 다른 업장 사진은 제외."
  }[focus]
  return `"${name}" (${kind} · ${subCategory})의 사진 ${count}장(0번부터)이다. 대표사진 하나를 골라라. ${priority} 공통 제외: 지도, 메뉴판·영수증, 로고만, 얼굴 클로즈업, 흐릿한 사진, 이 장소가 아닌 인접 건물. 적합한 사진이 없으면 -1. 반드시 {"bestIndex":0} JSON만 답해라.`
}
export function preferredPhotoRefs(refs: string[] | null | undefined, preferred?: string | null): string[] {
  const unique = [...new Set((refs ?? []).filter(Boolean))]
  return preferred && unique.includes(preferred) ? [preferred, ...unique.filter(r => r !== preferred)] : unique
}

export function coverPolicyVersion(name: string, kind: string, subCategory = ""): string {
  return photoFocus(name, kind, subCategory) === "airport" ? "airport-interior-v4" : "category-v2"
}
