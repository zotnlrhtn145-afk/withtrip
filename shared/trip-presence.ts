/**
 * 누가 언제부터 언제까지 이 여행에 함께 있는가.
 *
 * ## 왜 필요한가
 *
 * 같은 여행이라도 다 같이 출발하지 않는다. 실제 데이터가 그렇다:
 *
 *   제주도 — 김동현은 10:10 도착, 오수환·오정환은 10:25 도착.
 *            15분 차이로 따로 내려 공항에서 만나 13:00 동경밥상으로 함께 간다.
 *
 * 날짜가 아예 다른 경우도 있다 — 우리는 이미 이틀째 일정을 도는데 친구는
 * 그날 저녁에 합류한다. 그 친구 화면에서는 앞의 일정이 "내 일정" 이 아니다.
 *
 * ## 어디서 알아내나
 *
 * **교통편에 이미 누가 타는지 들어 있다**(`passenger_ids`). 그래서 합류
 * 시각을 따로 입력받을 필요가 없다 — 도착편이 곧 합류다.
 *
 * ⚠️ 다만 **근거로 삼기엔 데이터가 성기다.** 여행 6개를 다 봤다:
 *    - 호치민 편은 `arrive_date` 가 비어 있다 (시각만 있고 날짜가 없다)
 *    - 부산요트파티의 한 교통편은 **여행 기간 밖**이다 (8/5, 여행은 8/7~8/9)
 *    - 부산 여름휴가는 멤버 중 한 명만 교통편이 있다
 *
 *    그래서 규칙은 **"있으면 쓰고, 없으면 처음부터 함께"** 다. 모르는 것을
 *    지어내서 "이 사람은 아직 안 왔습니다" 라고 하면, 멀쩡히 있는 사람이
 *    일정에서 사라진다. 그쪽이 훨씬 나쁘다.
 *
 * ⚠️ 시각은 **도착지 현지 시각**이다(항공권에 적힌 그대로). 합류 시각도
 *    그대로 쓴다 — 도착한 뒤로는 그 곳 시계로 사는 게 맞다.
 *    자세한 건 `flight-time.ts`.
 */

/** `2026-08-27` + `10:25` — 비교만 하면 되므로 문자열로 둔다 */
export type Moment = { date: string; time: string }

export type PresenceInput = {
  /** 여행 기간. 이 밖의 교통편은 이 여행과 무관한 것으로 본다 */
  startDate: string | null
  endDate: string | null
  /** 이 여행에 이름이 올라 있는 사람 전부 */
  personIds: string[]
  transports: {
    passengerIds: string[]
    departDate: string | null
    departTime: string | null
    arriveDate: string | null
    arriveTime: string | null
  }[]
}

export type Presence = {
  personId: string
  /** 이 시각부터 함께. null 이면 **처음부터** 함께 (교통편이 없거나 못 읽음) */
  joinsAt: Moment | null
  /** 이 시각에 떠남. null 이면 **끝까지** 함께 */
  leavesAt: Moment | null
}

/** 날짜·시각을 한 줄로 붙여 비교한다. 둘 다 0 채움 형식이라 문자열 비교로 충분하다 */
function key(m: Moment): string {
  return `${m.date} ${m.time.padStart(5, "0")}`
}

export function momentBefore(a: Moment, b: Moment): boolean {
  return key(a) < key(b)
}

function asMoment(date: string | null, time: string | null): Moment | null {
  const d = String(date ?? "").trim()
  const t = String(time ?? "").trim()
  // ⚠️ 날짜가 없으면 버린다. 시각만으로는 며칠인지 알 수 없고,
  //    출발 날짜에 붙여 버리면 밤 비행기가 하루 틀어진다.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const hm = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!hm) return null
  return { date: d, time: `${hm[1].padStart(2, "0")}:${hm[2]}` }
}

function inWindow(m: Moment, start: string | null, end: string | null): boolean {
  const s = String(start ?? "").trim()
  const e = String(end ?? "").trim()
  if (s && m.date < s) return false
  if (e && m.date > e) return false
  return true
}

/**
 * 사람마다 합류·이탈 시각을 구한다.
 *
 * 합류 = 여행 기간 안에서 **가장 이른 도착**.
 * 이탈 = 여행 기간 안에서 **가장 늦은 출발**.
 *
 * ⚠️ 돌아오는 편의 도착(집)도 기간 안에 들어오지만, "가장 이른" 도착을
 *    고르므로 합류 시각을 망치지 않는다. 같은 이유로 가는 편의 출발은
 *    "가장 늦은" 출발에 밀린다.
 */
export function computePresence(input: PresenceInput): Map<string, Presence> {
  const out = new Map<string, Presence>()
  for (const id of input.personIds) out.set(id, { personId: id, joinsAt: null, leavesAt: null })

  /*
    ⚠️ **두 번 훑는다. 합류를 먼저 다 구하고, 그다음에 이탈을 본다.**
       한 번에 하면 **가는 편의 출발**(집에서 떠나는 것)이 이탈로 잡힌다.
       그러면 "10:00 합류, 09:00 이탈" 같은 줄이 생기고, 그 사람은 여행
       내내 없는 사람이 된다. 시험에서 실제로 그렇게 나왔다.
       이탈은 **합류한 뒤에 떠나는 것**만 이탈이다.
  */
  for (const t of input.transports) {
    const arrive = asMoment(t.arriveDate, t.arriveTime)
    if (!arrive || !inWindow(arrive, input.startDate, input.endDate)) continue
    for (const pid of t.passengerIds ?? []) {
      const cur = out.get(pid)
      if (!cur) continue // 이 여행 사람이 아니면 무시
      if (!cur.joinsAt || momentBefore(arrive, cur.joinsAt)) cur.joinsAt = arrive
    }
  }

  for (const t of input.transports) {
    const depart = asMoment(t.departDate, t.departTime)
    if (!depart || !inWindow(depart, input.startDate, input.endDate)) continue
    for (const pid of t.passengerIds ?? []) {
      const cur = out.get(pid)
      if (!cur || !cur.joinsAt) continue
      if (!momentBefore(cur.joinsAt, depart)) continue // 합류 전의 출발은 이탈이 아니다
      if (!cur.leavesAt || momentBefore(cur.leavesAt, depart)) cur.leavesAt = depart
    }
  }

  /*
    ⚠️ **떠나기만 하고 오지 않은 사람**은 이탈을 지운다.
       부산요트파티가 그렇다 — 김동현의 교통편은 8/5 수서역→포항역 하나뿐이고
       부산으로 오는 편이 없다. 이걸 그대로 쓰면 "여행 내내 있다가 마지막에
       떠남" 이 아니라 엉뚱한 시각에 사라진 사람이 된다.
       올 때가 없으면 갈 때도 모르는 것으로 본다.
  */
  for (const p of out.values()) {
    if (!p.joinsAt) p.leavesAt = null
  }
  return out
}

/** 그 시각에 이 사람이 여행에 있는가 */
export function isPresent(p: Presence | undefined, at: Moment): boolean {
  if (!p) return true // 모르면 있는 것으로 본다 — 멀쩡히 있는 사람을 지우지 않는다
  if (p.joinsAt && momentBefore(at, p.joinsAt)) return false
  if (p.leavesAt && momentBefore(p.leavesAt, at)) return false
  return true
}

export type PresenceEvent = {
  at: Moment
  kind: "join" | "leave"
  personIds: string[]
  /** 이 일이 일어난 **뒤** 함께 있는 사람 수 */
  countAfter: number
  /** 이 순간 전원이 모였나 (합류일 때만 의미 있다) */
  everyoneNow: boolean
}

/**
 * 타임라인에 얹을 「합류 / 먼저 출발」 띠.
 *
 * ⚠️ **아무 일도 안 일어나면 빈 배열을 준다.** 다 같이 왔다 다 같이 가는
 *    여행이 대부분이고, 거기에 띠를 그리면 화면만 시끄러워진다.
 *    (혼자 하는 여행도 마찬가지 — 알려 줄 게 없다)
 */
export function presenceEvents(presence: Map<string, Presence>): PresenceEvent[] {
  const all = [...presence.values()]
  if (all.length < 2) return []

  const joins = new Map<string, string[]>()
  const leaves = new Map<string, string[]>()
  for (const p of all) {
    if (p.joinsAt) {
      const k = key(p.joinsAt)
      joins.set(k, [...(joins.get(k) ?? []), p.personId])
    }
    if (p.leavesAt) {
      const k = key(p.leavesAt)
      leaves.set(k, [...(leaves.get(k) ?? []), p.personId])
    }
  }

  // 처음부터 있던 사람(교통편을 모르는 사람) 수
  const fromStart = all.filter((p) => !p.joinsAt).length

  const events: PresenceEvent[] = []
  let running = fromStart
  for (const k of [...joins.keys()].sort()) {
    const ids = joins.get(k)!
    running += ids.length
    const [date, time] = k.split(" ")
    events.push({
      at: { date, time },
      kind: "join",
      personIds: ids,
      countAfter: running,
      everyoneNow: running === all.length,
    })
  }

  /*
    ⚠️ **모두가 같은 시각에 떠나는 건 이별이 아니다.** 여행이 끝나는 것뿐이다.
       마지막 한 번은 띠로 그리지 않는다 — 그리면 모든 여행 끝에 "먼저 출발"
       이라는 이상한 줄이 붙는다.
  */
  const leaveKeys = [...leaves.keys()].sort()
  const lastLeave = leaveKeys[leaveKeys.length - 1]
  let left = 0
  for (const k of leaveKeys) {
    const ids = leaves.get(k)!
    left += ids.length
    if (k === lastLeave && left === all.length) continue
    const [date, time] = k.split(" ")
    events.push({
      at: { date, time },
      kind: "leave",
      personIds: ids,
      countAfter: all.length - left,
      everyoneNow: false,
    })
  }

  events.sort((a, b) => key(a.at).localeCompare(key(b.at)))
  // 합류가 하나뿐이고 그게 곧 전원이면(= 다 같이 출발) 알려 줄 게 없다
  if (events.length === 1 && events[0].kind === "join" && events[0].countAfter === all.length && fromStart === 0) {
    return []
  }
  return events
}
