/**
 * 「여기 들렀다 가도 늦지 않나?」 — 정해진 다음 일정까지 계산해 준다.
 *
 * ## ⚠️ 왜 만들었나 (신고받은 실제 상황)
 *
 * "오늘 7시 비행기라 렌트카를 반납해야 하는데, 3시에 양가형제에서 늦은 점심을
 *  먹으려다 **브레이크타임이 3-4시**인 걸 알았다. 급하게 찜에서 다른 데를 찾는데
 *  **각 후보까지 몇 분인지, 거기서 반납처까지 또 몇 분인지 몰라서** 티맵을 하나하나
 *  켜서 검색하고 경우의 수를 따져야 했다. 너무 힘들었다."
 *
 * 필요한 재료는 이제 다 있다 — 영업시간(`opening-hours`), 실제 도로 시간
 * (카카오), 찜 목록. 이 파일은 그걸 **하나의 답**으로 합친다.
 *
 * ## ⚠️ 세 구간을 다 봐야 답이 나온다
 *
 *     지금 있는 곳 ──(가는 시간)──▶ 후보 ──(머무는 시간)──▶ ──(가는 시간)──▶ 마감 장소
 *
 * 사용자가 티맵을 **두 번** 켜야 했던 이유가 이것이다. 하나만 재면 "갈 수는 있는데
 * 거기서 못 돌아오는" 답이 나온다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

import { openState, type OpenState, type Period } from "./opening-hours"

/**
 * 그 종류의 곳에서 보통 얼마나 머무는가(분).
 *
 * ⚠️ **넉넉하게 잡는다.** 짧게 잡으면 "갈 수 있다" 고 해 놓고 실제로는 늦는다.
 *    늦는 쪽이 못 가는 쪽보다 훨씬 나쁘다 — 비행기를 놓친다.
 * ⚠️ 사용자가 고칠 수 있게 열어 둔다(`stayMin` 을 직접 주면 그걸 쓴다).
 */
export const STAY_MIN: Record<string, number> = {
  식사: 60,
  카페: 40,
  관광: 60,
  쇼핑: 40,
  체험: 90,
  숙소: 30,
}
export const STAY_DEFAULT = 45

export type Candidate = {
  id: string
  name: string
  /** 화면에 함께 보여 줄 분류 */
  category?: string | null
  subCategory?: string | null
  /** 가는 시간(분). 못 구했으면 null — 그때는 판정하지 않는다 */
  goMin: number | null
  /** 거기서 마감 장소까지(분). 못 구했으면 null */
  backMin: number | null
  /** 머무는 시간(분). 없으면 분류에서 정한다 */
  stayMin?: number | null
  /** 영업시간 — 도착 시각에 열려 있는지 본다 */
  periods?: Period[] | null
  utcOffsetMin?: number | null
}

export type Verdict = {
  id: string
  name: string
  category?: string | null
  subCategory?: string | null
  /** 넉넉 / 빠듯 / 무리 / 판단 못 함 */
  fit: "ok" | "tight" | "no" | "unknown"
  goMin: number | null
  stayMin: number
  backMin: number | null
  /** 도착·출발·마감 장소 도착 시각 (`HH:MM`) */
  arriveAt: string | null
  leaveAt: string | null
  backAt: string | null
  /** 마감까지 남는 분. 음수면 늦는다 */
  slackMin: number | null
  /** 도착 시각 기준 영업 상태 */
  open: OpenState
  /** 사람이 읽는 한 줄 이유 */
  why: string
}

function hhmm(totalMin: number): string {
  const m = ((Math.round(totalMin) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** `"14:30"` → 870. 못 읽으면 null */
export function toMin(hm: string | null | undefined): number | null {
  const m = String(hm ?? "").match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return h * 60 + mi
}

/** 빠듯하다고 볼 여유(분). 이보다 적게 남으면 경고한다 */
export const TIGHT_MIN = 20

/**
 * 후보 하나를 판정한다.
 *
 * @param startMin 출발 가능 시각(분). 보통 앞 일정이 끝나는 때
 * @param deadlineMin 마감 시각(분). 렌트카 반납·탑승 수속 등
 * @param dayMs 그날 자정의 밀리초 — 영업시간을 그 시각으로 판단하는 데 쓴다
 */
export function judge(
  c: Candidate,
  startMin: number,
  deadlineMin: number,
  dayMs: number
): Verdict {
  const stay = c.stayMin ?? STAY_MIN[c.category ?? ""] ?? STAY_DEFAULT
  const base = {
    id: c.id,
    name: c.name,
    category: c.category,
    subCategory: c.subCategory,
    goMin: c.goMin,
    stayMin: stay,
    backMin: c.backMin,
  }

  /*
    ⚠️ **시간을 못 구했으면 판정하지 않는다.** 모르는 걸 "갈 수 있다" 고 하면
       그걸 믿고 갔다가 비행기를 놓친다. 모른다고 말하는 편이 낫다.
  */
  if (c.goMin == null || c.backMin == null) {
    return {
      ...base,
      fit: "unknown",
      arriveAt: null,
      leaveAt: null,
      backAt: null,
      slackMin: null,
      open: { state: "unknown" },
      why: "가는 시간을 못 구했어요",
    }
  }

  let arrive = startMin + c.goMin
  const openAtArrive = openState(c.periods, c.utcOffsetMin, dayMs + arrive * 60_000)

  /*
    ⚠️ **쉬는 시간이면 문 열 때까지 기다린 걸로 계산한다.** 그냥 "갈 수 있다" 고
       하면 도착해서 한 시간을 문 앞에서 보낸다 — 겪으신 그 상황이다.
       기다리는 시간을 넣고 다시 재야 진짜 답이 나온다.
  */
  let waited = 0
  if (openAtArrive.state === "break" || (openAtArrive.state === "closed" && openAtArrive.reason === "before")) {
    const opens = toMin(openAtArrive.state === "break" ? openAtArrive.opensAt : openAtArrive.opensAt ?? "")
    if (opens != null && opens > arrive) {
      waited = opens - arrive
      arrive = opens
    }
  }

  const leave = arrive + stay
  const back = leave + c.backMin
  const slack = deadlineMin - back

  /* 오늘 문을 안 여는 곳은 시간이 남아도 못 간다 */
  const shut =
    openAtArrive.state === "closed" &&
    (openAtArrive.reason === "dayoff" || openAtArrive.reason === "after")

  const fit: Verdict["fit"] = shut ? "no" : slack < 0 ? "no" : slack < TIGHT_MIN ? "tight" : "ok"

  const why = shut
    ? openAtArrive.state === "closed" && openAtArrive.reason === "dayoff"
      ? "오늘 휴무예요"
      : "도착하면 이미 영업이 끝나요"
    : slack < 0
      ? `${-slack}분 늦어요`
      : waited > 0
        ? `문 열 때까지 ${waited}분 기다려야 해요 · ${slack}분 남음`
        : `${slack}분 남음`

  return {
    ...base,
    fit,
    arriveAt: hhmm(arrive),
    leaveAt: hhmm(leave),
    backAt: hhmm(back),
    slackMin: slack,
    open: openAtArrive,
    why,
  }
}

/**
 * 여러 후보를 판정하고 **고르기 좋은 순서**로 늘어놓는다.
 *
 * ⚠️ 「여유가 많은 순」이 아니라 **「갈 만한 것 먼저」** 다. 여유만으로 줄 세우면
 *    가장 가까운 편의점이 1등이 된다 — 사용자가 찾는 건 "갈 수 있는 곳 중에서
 *    무엇을 고를까" 이지 "가장 빨리 끝나는 곳" 이 아니다.
 * ⚠️ 같은 등급 안에서는 **가는 시간이 짧은 순**이다. 여유가 많다는 건 대개
 *    가깝다는 뜻이라 결과가 비슷하지만, 이쪽이 뜻이 분명하다.
 */
export function rank(list: Verdict[]): Verdict[] {
  const order: Record<Verdict["fit"], number> = { ok: 0, tight: 1, unknown: 2, no: 3 }
  return list.slice().sort((a, b) => {
    if (order[a.fit] !== order[b.fit]) return order[a.fit] - order[b.fit]
    return (a.goMin ?? 9999) - (b.goMin ?? 9999)
  })
}
