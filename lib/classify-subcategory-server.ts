/**
 * 세부 카테고리 AI 보정 — **서버에서 쓰는 한 곳**.
 *
 * ## ⚠️ 왜 이 파일이 생겼나
 *
 * 보정이 **웹의 「장소 추가」 모달에서만** 돌고 있었다. 인스타 공유로 들어오는
 * 길은 정규식만 쓰고 여기를 안 거쳐서, 같은 가게가 **어디로 들어오느냐에 따라
 * 다르게 분류**됐다. 실제로 재 보면 이렇다.
 *
 *     인스타 공유    27 / 243  = 11%   가 「기타」
 *     직접 등록·검색   4 / 333  =  1.2%
 *
 * 「돈꿀돼지국밥」·「봉성식당」처럼 사람이 보면 1초에 아는 것들이 기타로 쌓였다
 * (신고받음). 고칠 자리가 둘이면 **한쪽만 고쳐진다** — 그래서 한 곳으로 모은다.
 *
 * ## ⚠️ 돈이 새지 않게 하는 규칙 셋
 *
 *   · **정규식이 먼저다.** `guessSubCategory` 가 답을 내면 AI 를 안 부른다.
 *     지금 데이터로 재면 정규식만으로 15/34 가 잡힌다 — 그만큼이 0원이다.
 *   · **묶어서 한 번에 묻는다.** 인스타 하나에 가게가 여러 곳 나온다. 곳마다
 *     부르면 호출이 그만큼 늘고, 답의 질은 다르지 않다.
 *   · **모델 이름을 박지 않는다.** 박아 둔 이름은 조용히 404 가 되어 기능이
 *     통째로 죽는다 — 두 번 당했다. 살아 있는 목록에서 고른다.
 */

import { normalizeSubCategory } from "@/shared/place-subcategories"

import { flashModelCandidates, isTransient, sleep } from "@/lib/gemini-models"

/**
 * 고를 수 있는 값. **여기 없는 값이 오면 버린다** — 화면의 칩과 어긋나면 안 된다.
 *
 * ⚠️ **관광지·쇼핑·체험이 빠져 있었다.** 셋이 없으니 부르는 쪽도 셋을 걸러내고
 *    넘겼고(「관광지는 뺀다 — 고를 값 목록이 AI 쪽에 없다」라고 적혀 있었다),
 *    그래서 정규식이 못 잡은 관광지·쇼핑은 **AI 를 볼 기회조차 없이** 「기타」로
 *    굳었다(실측: 호수·포토스팟·편집숍 두 곳이 그렇게 들어왔다).
 * ⚠️ 값은 `shared/place-subcategories.ts` 의 목록과 **글자까지 같아야 한다.**
 *    한 글자만 달라도 화면의 칩과 안 맞아서 그 줄이 통째로 버려진다.
 */
export const SUBCATEGORIES_BY_KIND: Record<string, string[]> = {
  restaurant: [
    "한식", "일식", "스시", "국수·면요리", "중식", "이탈리안", "프렌치",
    "양식", "고기·구이", "해산물", "브런치", "카페", "디저트", "기타",
  ],
  bar: ["칵테일 바", "와인 바", "이자카야", "펍", "루프탑 라운지", "기타"],
  stay: ["호텔", "리조트", "료칸", "게스트하우스", "펜션", "기타"],
  attraction: ["랜드마크", "박물관·미술관", "공원·자연", "사원·종교시설", "전망대", "쇼핑·거리", "기타"],
  shopping: ["백화점·몰", "편집숍·패션", "기념품·특산품", "생활·잡화", "서점", "기타"],
  experience: ["공연·전시", "클래스·체험", "스파·웰니스", "액티비티", "기타"],
}

export type ClassifyKind = "restaurant" | "bar" | "stay" | "attraction" | "shopping" | "experience"

const KIND_LABEL: Record<ClassifyKind, string> = {
  restaurant: "레스토랑",
  bar: "바/라운지",
  stay: "숙소",
  attraction: "관광지",
  shopping: "쇼핑",
  experience: "체험",
}

export function isClassifyKind(v: unknown): v is ClassifyKind {
  return typeof v === "string" && v in KIND_LABEL
}

export type ClassifyItem = {
  /** 부르는 쪽이 답을 되찾을 열쇠 */
  key: string
  kind: ClassifyKind
  placeName: string
  localName?: string | null
  address?: string | null
}

function apiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "").trim()
}

/**
 * 여러 곳을 **한 번에** 분류한다. `key → 세부 카테고리` 로 돌려준다.
 *
 * ⚠️ 실패하면 **빈 값을 돌려준다.** 던지지 않는다 — 분류는 있으면 좋은 것이지,
 *    이것 때문에 공유 자체가 실패하면 안 된다.
 * ⚠️ 확신이 없으면 AI 가 「기타」를 고르게 해 두었다. 억지로 채우면 **틀린 칸에
 *    들어간 가게**가 생기는데, 그건 비어 있는 것보다 나쁘다 — 사용자가 그 칸을
 *    믿고 거르기 때문이다.
 */
export async function classifySubCategories(
  items: ClassifyItem[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const todo = items.filter((i) => i.placeName.trim())
  if (todo.length === 0) return out

  const key = apiKey()
  if (!key) return out
  const models = await flashModelCandidates(key)
  if (models.length === 0) return out

  const lines = todo.map((it, i) => {
    const local = it.localName && it.localName !== it.placeName ? ` (${it.localName})` : ""
    return `${i + 1}. [${KIND_LABEL[it.kind]}] ${it.placeName}${local} / 주소: ${it.address || "정보 없음"}`
  })

  /* 종류가 섞여 있으므로 **줄마다 고를 수 있는 값이 다르다.** 목록을 함께 적는다 */
  const kinds = Array.from(new Set(todo.map((i) => i.kind)))
  const optionText = kinds
    .map((k) => `${KIND_LABEL[k]}: ${SUBCATEGORIES_BY_KIND[k].join(", ")}`)
    .join("\n")

  const prompt =
    `다음은 지도 검색으로 찾은 장소들이다. 각각의 세부 카테고리를 정하라.\n\n` +
    `${lines.join("\n")}\n\n` +
    `고를 수 있는 값 (분류별로 다르다):\n${optionText}\n\n` +
    `이름이 유명 체인/브랜드라면 실제로 알려진 사실을 활용하라 ` +
    `(예: "이치란"은 라멘 전문점이므로 국수·면요리).\n` +
    `확실한 근거가 없으면 "기타"를 골라라. 억지로 채우지 마라.\n` +
    `반드시 {"results":[{"n":1,"subCategory":"..."}]} 형태의 JSON 으로만 답하라. ` +
    `목록에 없는 값은 절대 쓰지 마라.`

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
          }
        )
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          /*
            ⚠️ 503(과부하)·429 는 **잠깐 기다렸다 같은 모델에 다시 묻는다.** 바로
               다음 모델로 넘어가면 더 나쁜 모델을 쓰게 된다.
          */
          if (isTransient(res.status, body) && attempt === 0) {
            await sleep(800)
            continue
          }
          break
        }
        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!raw) break
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          results?: Array<{ n?: unknown; subCategory?: unknown }>
        }
        for (const r of parsed.results ?? []) {
          const idx = Number(r.n) - 1
          const it = todo[idx]
          if (!it) continue
          /*
            ⚠️ **거의 맞는 답을 버리지 않는다.** 예전엔 글자가 똑같을 때만 인정해서
               「편집숍」(목록은 편집숍·패션)·「한식당」(목록은 한식)이 통째로
               버려지고 「기타」로 떨어졌다 — 답은 있는데 받는 문이 좁았다.
            ⚠️ 그래도 못 옮기면 안 적는다. 지어내면 **틀린 칸에 들어간 가게**가
               생기는데, 그건 비어 있는 것보다 나쁘다.
          */
          const sub = normalizeSubCategory(it.kind, String(r.subCategory ?? ""))
          if (sub && sub !== "기타") out.set(it.key, sub)
        }
        return out
      } catch {
        break
      }
    }
  }
  return out
}
