/**
 * 지금 문을 열었나 — 영업시간 판단.
 *
 * ## ⚠️ 왜 필요한가 (신고받은 실제 상황)
 *
 * "3시에 양가형제에서 식사하려 했는데 **알고 보니 브레이크타임이 3-4시**였다.
 *  급하게 찜에서 다른 데를 찾았는데 영업 중인지 알 수 없어 네이버를 찾아봤다."
 *
 * 그 값은 이미 받아오고 있었다. 다만 상세 화면을 열어야만 보였다.
 *
 * ## ⚠️ 글자를 파싱하지 않는다
 *
 * 구글은 사람이 읽는 문장(`weekday_text`)과 **숫자(`periods`)** 를 같이 준다.
 * "오전 11:00 ~ 오후 3:00, 오후 4:00~7:30" 을 파싱하면 언어·표기가 바뀔 때
 * 조용히 깨진다. 판단은 숫자로만 하고, 글자는 화면에 그대로 보여 줄 때만 쓴다.
 *
 * ## ⚠️ 현지 시각으로 판단한다
 *
 * 도쿄 가게가 열었는지를 **한국 시각으로 재면 한 시간이 어긋난다.** 여행 앱에서
 * 이건 흔한 상황이지 예외가 아니다. 그래서 `utcOffsetMin` 을 반드시 받는다.
 * 없으면 **모른다고 답한다** — 틀린 답보다 낫다.
 *
 * ⚠️ 이 파일은 `~/withtrip/shared/` 가 원본이다.
 *    앱 쪽 `src/lib/shared/` 는 복사본이므로 직접 고치지 말 것.
 */

/** 구글 `opening_hours.periods` 한 조각. `day` 는 0=일요일, `time` 은 `"1100"` */
export type Period = {
  open?: { day?: number; time?: string } | null
  close?: { day?: number; time?: string } | null
}

export type OpenState =
  /** 지금 영업 중 */
  | { state: "open"; until: string | null }
  /**
   * 오늘 열긴 하는데 **지금은 쉬는 시간**.
   * ⚠️ `closed` 와 반드시 나눈다 — "조금 뒤에 열린다" 와 "오늘은 끝났다" 는
   *    사용자가 할 행동이 완전히 다르다(기다린다 vs 딴 데를 찾는다).
   */
  | { state: "break"; opensAt: string }
  /** 지금 닫혔다. `opensAt` 이 있으면 오늘 안에 다시 연다 */
  | { state: "closed"; opensAt: string | null; reason: "before" | "after" | "dayoff" }
  /** 24시간 */
  | { state: "always" }
  /** 값이 없어서 모른다. **모르면 모른다고 한다** */
  | { state: "unknown" }

/** `"1100"` → 660(분). 이상한 값이면 null */
function toMinutes(time: string | null | undefined): number | null {
  const t = String(time ?? "").trim()
  if (!/^\d{4}$/.test(t)) return null
  const h = Number(t.slice(0, 2))
  const m = Number(t.slice(2))
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

/** 660 → `"11:00"` */
export function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/**
 * 한 주를 분 단위 구간으로 편다. 0 = 일요일 0시, 최대 10080(7일).
 *
 * ⚠️ **자정을 넘기는 영업이 흔하다**(인디안썸머 애월: 오후 5시 ~ 오전 1시).
 *    닫는 시각이 여는 시각보다 앞이면 다음 날로 넘어간 것으로 본다.
 * ⚠️ 주말을 넘겨 끝나는 구간(토요일 밤 → 일요일 새벽)은 **앞으로 한 번 더**
 *    복제해 둔다. 안 그러면 일요일 0시 30분에 "닫힘" 이 된다.
 */
function spans(periods: Period[]): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = []
  for (const p of periods) {
    const od = p.open?.day
    const om = toMinutes(p.open?.time)
    if (od == null || od < 0 || od > 6 || om == null) continue

    const from = od * 1440 + om
    // 닫는 값이 아예 없으면 24시간 영업이다 (구글 규칙)
    if (!p.close) return [{ from: 0, to: 10080 }]

    const cd = p.close.day ?? od
    const cm = toMinutes(p.close.time)
    if (cm == null) continue
    let to = cd * 1440 + cm
    if (to <= from) to += 7 * 1440 // 자정·주말을 넘긴 경우

    out.push({ from, to })
    /* 주를 넘겨 끝나는 구간은 한 주 앞에도 놓아 둔다 */
    if (to > 10080) out.push({ from: from - 10080, to: to - 10080 })
  }
  return out.sort((a, b) => a.from - b.from)
}

/**
 * 지금 상태.
 *
 * @param periods 구글 `opening_hours.periods`
 * @param utcOffsetMin 그 장소의 UTC 시차(분). **없으면 판단하지 않는다**
 * @param nowMs 기준 시각(밀리초). 시험용으로 주입할 수 있게 열어 둔다
 */
export function openState(
  periods: Period[] | null | undefined,
  utcOffsetMin: number | null | undefined,
  nowMs: number = Date.now()
): OpenState {
  if (!periods || periods.length === 0) return { state: "unknown" }
  if (utcOffsetMin == null || !Number.isFinite(utcOffsetMin)) return { state: "unknown" }

  const list = spans(periods)
  if (list.length === 0) return { state: "unknown" }
  if (list.length === 1 && list[0].from === 0 && list[0].to === 10080) return { state: "always" }

  /* 그 장소의 현지 시각을 "한 주 안의 분" 으로 만든다 */
  const local = new Date(nowMs + utcOffsetMin * 60_000)
  const at = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes()

  const inNow = list.find((s) => at >= s.from && at < s.to)
  if (inNow) return { state: "open", until: hhmm(inNow.to) }

  /* 앞으로 열리는 것 중 가장 이른 것 */
  const next = list.filter((s) => s.from > at).sort((a, b) => a.from - b.from)[0]

  /* 오늘 안에 다시 여는가 = 쉬는 시간인가 */
  const dayStart = Math.floor(at / 1440) * 1440
  const dayEnd = dayStart + 1440
  if (next && next.from < dayEnd) {
    /*
      오늘 이미 한 번 열었었다면 「브레이크타임」, 아직이면 「아직 안 열었음」.

      ⚠️ **「오늘 시작한」 영업만 센다.** 끝나는 시각만 보면 **어젯밤에 열어
         오늘 새벽에 닫은 영업**까지 세어져서, 오후 4시에 「쉬는 시간」이라고
         한다(인디안썸머 애월: 17시~새벽 1시. 오후 4시는 아직 안 연 것이지
         쉬는 게 아니다).
    */
    const openedToday = list.some((s) => s.from >= dayStart && s.to <= at)
    return openedToday
      ? { state: "break", opensAt: hhmm(next.from) }
      : { state: "closed", opensAt: hhmm(next.from), reason: "before" }
  }

  /* 오늘은 아예 영업 구간이 없었나 */
  const hadToday = list.some((s) => s.from < dayEnd && s.to > dayEnd - 1440)
  return {
    state: "closed",
    opensAt: next ? hhmm(next.from) : null,
    reason: hadToday ? "after" : "dayoff",
  }
}

/** 목록에 붙일 짧은 딱지 — 「영업 중 · 19:30까지」 */
export function openLabel(s: OpenState): { text: string; tone: "good" | "warn" | "off" | "none" } {
  switch (s.state) {
    case "always":
      return { text: "24시간", tone: "good" }
    case "open":
      return { text: s.until ? `영업 중 · ${s.until}까지` : "영업 중", tone: "good" }
    /* ⚠️ 브레이크타임은 **주황**이다. 빨강이면 "오늘 끝" 으로 읽혀서 후보에서 뺀다 */
    case "break":
      return { text: `쉬는 시간 · ${s.opensAt} 다시 열어요`, tone: "warn" }
    case "closed":
      if (s.reason === "dayoff") return { text: "오늘 휴무", tone: "off" }
      if (s.reason === "before" && s.opensAt) return { text: `${s.opensAt} 오픈`, tone: "warn" }
      return { text: "영업 종료", tone: "off" }
    default:
      /* ⚠️ 모를 땐 **아무 말도 안 한다.** 「영업시간 모름」을 띄우면 목록이
            그 글자로 도배되고, 아는 곳의 딱지까지 눈에 안 들어온다 */
      return { text: "", tone: "none" }
  }
}
