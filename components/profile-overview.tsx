"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, Settings, Users } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { TripRouteMap } from "@/components/trip-route-map"
import { PlaceDetailSheet, type PlaceDetailInput } from "@/components/place-detail-sheet"
import { DirectionsMenu } from "@/components/directions-menu"
import { createClient } from "@/utils/supabase/client"
import { canReadPersonalRecord, fetchAcceptedRecordTripIds } from "@/shared/profile-record-access"
import { DEFAULT_FEE_RATE, toKrw } from "@/shared/fx"
import type { Trip } from "@/lib/trip-data"
import type { UserProfile } from "@/lib/user-api"
import styles from "./profile-overview.module.css"

type Stop = { id: string; day_number: number | null; place_name: string | null; visit_time: string | null; category: string | null; address: string | null; lat: number | null; lng: number | null }
type Detail = { stops: Stop[]; total: number | null; totalEstimated?: boolean; people: { id: string; name: string; avatarUrl?: string | null }[] }
type Follower = { id: string; nickname: string; avatar_url: string | null }
const detailPromises = new Map<string, Promise<Detail>>()
async function loadDetail(trip: Trip, userId: string): Promise<Detail> {
  const db = createClient()
  const { data: auth } = await db.auth.getUser()
  if (auth.user?.id !== userId) throw new Error("내 여행만 확인할 수 있어요.")
  const tripFees = await db.from("trips").select("user_id, fx_fee_rate").eq("id", trip.id).maybeSingle()
  if (tripFees.error || !tripFees.data) throw new Error("여행을 확인할 수 없어요.")
  if (tripFees.data.user_id !== userId) {
    const membership = await db.from("trip_members").select("status").eq("trip_id", trip.id).eq("user_id", userId).eq("status", "accepted").maybeSingle()
    if (membership.error || !canReadPersonalRecord(userId, tripFees.data.user_id, membership.data?.status)) throw new Error("참여한 여행만 확인할 수 있어요.")
  }
  const [schedules, expenses, members, guests, payerFees] = await Promise.all([
    db.from("trip_schedules").select("id, day_number, place_name, visit_time, category, address, lat, lng").eq("trip_id", trip.id).order("day_number").order("visit_time"),
    db.from("expenses").select("amount, currency, fx_rate, payer_id").eq("trip_id", trip.id),
    db.from("trip_members").select("user_id").eq("trip_id", trip.id).eq("status", "accepted"),
    db.from("settlement_guests").select("id, name").eq("trip_id", trip.id),
    db.from("trip_fx_fees").select("user_id, fee_rate").eq("trip_id", trip.id),
  ])
  if (schedules.error) throw schedules.error
  const ids = [...new Set([tripFees.data.user_id, ...(members.data ?? []).map(p => p.user_id)].filter((id): id is string => Boolean(id)))]
  const profiles = await db.from("profiles").select("id, nickname, avatar_url").in("id", ids)
  const feeValue = Number(tripFees.data?.fx_fee_rate)
  const feeRate = Number.isFinite(feeValue) && feeValue >= 0 ? feeValue : DEFAULT_FEE_RATE
  const byPayer = new Map((payerFees.data ?? []).filter(f => Number.isFinite(Number(f.fee_rate)) && Number(f.fee_rate) >= 0).map(f => [f.user_id, Number(f.fee_rate)]))
  return { stops: schedules.data ?? [], totalEstimated: (expenses.data ?? []).some(e => e.currency && e.currency !== "KRW" && !byPayer.has(e.payer_id)), total: expenses.error ? null : (expenses.data ?? []).reduce((sum, e) => sum + toKrw({ amount: Number(e.amount) || 0, currency: e.currency || "KRW", fxRate: Number(e.fx_rate) || 1 }, byPayer.get(e.payer_id) ?? feeRate), 0), people: [
    ...ids.map(id => { const p = profiles.data?.find(p => p.id === id); return { id, name: p?.nickname || "멤버", avatarUrl: p?.avatar_url } }),
    ...(guests.data ?? []).map(p => ({ id: p.id, name: p.name || "게스트", avatarUrl: null })),
  ] }
}
function Avatar({ uri, size = 24 }: { uri?: string | null; size?: number }) {
  return <span className={styles.avatar} style={{ width: size, height: size }}>{uri ? <img src={uri} alt="" /> : null}</span>
}
function EmptyRecord() {
  const reduced = useReducedMotion()
  return <div className={styles.empty}><motion.img src="/design/profile/trips-empty.svg" alt="" width={92} height={92} initial={reduced ? false : { opacity: 0, rotateY: -65, scaleX: .5 }} animate={{ opacity: 1, rotateY: 0, scaleX: 1 }} transition={{ duration: .9, ease: [.22, 1, .36, 1] }} /><h3>여행이 쌓이면, 나만의 코스로</h3><p>함께 다녀온 사람과 방문한 장소를<br />여행이 끝나면 여기에서 다시 볼 수 있어요.</p></div>
}
/** 홈 Trip은 YYYY.MM.DD, 공개 DTO는 YYYY-MM-DD입니다. 같은 형식으로 비교합니다. */
export function isPastProfileRecord(endDate: string | null | undefined, today = new Date().toISOString().slice(0, 10)): boolean {
  const normalized = endDate?.replace(/\./g, "-")
  return Boolean(normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) && normalized < today)
}

export function ProfileOverview({ profile, trips, onSelectTrip, onSettings }: { profile: UserProfile | null; trips: Trip[]; onSelectTrip: (trip: Trip) => void; onSettings: () => void }) {
  const [counts, setCounts] = useState({ followers: 0, following: 0, published: 0 })
  const [selected, setSelected] = useState<{ trip: Trip; detail: Detail } | null>(null)
  const [followTab, setFollowTab] = useState<"followers" | "following" | null>(null)
  const [follows, setFollows] = useState<Follower[] | null>(null)
  const [followError, setFollowError] = useState(false)
  const [search, setSearch] = useState("")
  const [visible, setVisible] = useState(12)
  const [story, setStory] = useState<{ title: string; urls: string[]; index: number } | null>(null)
  const [storyTrips, setStoryTrips] = useState<{ trip: Trip; count: number; urls: string[] }[]>([])
  const [recordAccess, setRecordAccess] = useState<{ userId: string; ids: Set<string> } | null>(null)
  const [accessError, setAccessError] = useState(false)
  const [accessRetry, setAccessRetry] = useState(0)
  useEffect(() => {
    if (!profile?.id) { setRecordAccess(null); return }
    let alive = true
    const db = createClient()
    setAccessError(false)
    void (async () => {
      const { data: auth } = await db.auth.getUser()
      if (auth.user?.id !== profile.id) throw new Error("로그인이 필요해요.")
      const ids = await fetchAcceptedRecordTripIds(db, profile.id)
      if (alive) { detailPromises.clear(); setRecordAccess({ userId: profile.id, ids: new Set(ids) }) }
    })().catch(() => { if (alive) setAccessError(true) })
    return () => { alive = false }
  }, [profile?.id, trips, accessRetry])
  const accessReady = recordAccess?.userId === profile?.id
  const records = useMemo(() => trips.filter(t => Boolean(profile?.id) && (t.ownerId === profile?.id || (recordAccess?.userId === profile?.id && recordAccess?.ids.has(t.id))) && isPastProfileRecord(t.endDate)).sort((a, b) => b.endDate.localeCompare(a.endDate)), [trips, profile?.id, recordAccess])
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    const db = createClient()
    void Promise.all([db.from("follows").select("id", { head: true, count: "exact" }).eq("followee_id", profile.id), db.from("follows").select("id", { head: true, count: "exact" }).eq("follower_id", profile.id), db.from("trips").select("id", { head: true, count: "exact" }).eq("user_id", profile.id).eq("kind", "trip").eq("is_public", true).lt("end_date", new Date().toISOString().slice(0, 10))]).then(([followers, following, published]) => { if (alive) setCounts({ followers: followers.count ?? 0, following: following.count ?? 0, published: published.count ?? 0 }) })
    return () => { alive = false; detailPromises.clear() }
  }, [profile?.id])
  useEffect(() => {
    if (!records.length) { setStoryTrips([]); return }
    let alive = true
    const db = createClient()
    void db.from("schedule_photos").select("trip_id, path, kind").in("trip_id", records.slice(0, 10).map(t => t.id)).order("created_at").then(({ data }) => {
      if (!alive) return
      setStoryTrips(records.slice(0, 10).flatMap(trip => {
        const rows = (data ?? []).filter(p => p.trip_id === trip.id && p.kind !== "video" && p.path)
        const urls = rows.map(p => /^https?:/.test(p.path) ? p.path : db.storage.from("chat-images").getPublicUrl(p.path).data.publicUrl)
        return urls.length ? [{ trip, count: urls.length, urls }] : []
      }))
    })
    return () => { alive = false }
  }, [records])
  useEffect(() => {
    if (!followTab || !profile?.id) return
    let alive = true
    setFollows(null); setSearch(""); setFollowError(false)
    const db = createClient()
    void (async () => {
      const list = followTab === "followers" ? await db.from("follows").select("follower_id").eq("followee_id", profile.id) : await db.from("follows").select("followee_id").eq("follower_id", profile.id)
      if (list.error) throw list.error
      const ids = (list.data ?? []).map(r => "follower_id" in r ? r.follower_id : r.followee_id)
      const people = ids.length ? await db.from("profiles").select("id, nickname, avatar_url").in("id", ids) : { data: [], error: null }
      if (people.error) throw people.error
      if (alive) setFollows((people.data ?? []) as Follower[])
    })().catch(() => { if (alive) setFollowError(true) })
    return () => { alive = false }
  }, [followTab, profile?.id])
  return <div className={styles.overview}>
    <header className={styles.header}><h2>프로필</h2><nav><a href="/friends" aria-label="친구 관리"><Users size={24} /></a><button onClick={onSettings} aria-label="프로필 수정과 설정"><Settings size={24} /></button></nav></header>
    <div className={styles.identity}><button onClick={onSettings} aria-label="프로필 수정"><Avatar uri={profile?.avatarUrl} size={88} /></button><div><h3>{profile?.nickname || profile?.email?.split("@")[0] || "여행자"}</h3><div className={styles.stats}><span><b>{records.length}</b><small>코스</small></span><button onClick={() => setFollowTab("followers")}><b>{counts.followers}</b><small>팔로워</small></button><button onClick={() => setFollowTab("following")}><b>{counts.following}</b><small>팔로우</small></button></div></div></div>
    {storyTrips.length ? <section className={styles.stories}><div><span>여행의 순간들</span><small>나만 보는 기록</small></div><nav>{storyTrips.map(({ trip, urls }) => <button key={trip.id} onClick={() => setStory({ title: trip.title, urls, index: 0 })}><span><img src={urls[0]} alt="" /></span><small>{trip.endDate.slice(2, 4)} {trip.region}</small></button>)}</nav></section> : null}
    <div className={styles.sectionTitle}><h3>다녀온 코스</h3><span>공개한 코스 {counts.published}</span></div>
    {accessError ? <button className={styles.more} onClick={() => setAccessRetry(n => n + 1)}>참여한 여행을 불러오지 못했어요 · 다시 시도</button> : null}
    {records.length ? records.slice(0, visible).map(trip => <RecordCard key={trip.id} trip={trip} userId={profile!.id} onOpen={detail => setSelected({ trip, detail })} />) : !accessReady && !accessError ? <p className={styles.more}>여행 기록을 불러오는 중…</p> : accessError ? null : <EmptyRecord />}
    {records.length > visible ? <button className={styles.more} onClick={() => setVisible(n => n + 12)}>여행 기록 더 보기</button> : null}
    <RecordDialog value={selected} onClose={() => setSelected(null)} onSelectTrip={onSelectTrip} />
    <Dialog open={!!followTab} onOpenChange={open => { if (!open) setFollowTab(null) }}><DialogContent className="max-w-md rounded-3xl p-6"><DialogTitle className="text-xl">{followTab === "followers" ? "팔로워" : "팔로우"}</DialogTitle><div className={styles.followTabs}><button aria-selected={followTab === "followers"} onClick={() => setFollowTab("followers")}>{counts.followers} 팔로워</button><button aria-selected={followTab === "following"} onClick={() => setFollowTab("following")}>{counts.following} 팔로우</button></div><input aria-label="이름으로 검색" className={styles.search} placeholder="이름으로 검색" value={search} onChange={e => setSearch(e.target.value)} /><div className={styles.followList}>{followError ? <p>목록을 불러오지 못했어요.</p> : follows === null ? <p>불러오는 중…</p> : follows.filter(p => p.nickname?.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(p => <div key={p.id}><Avatar uri={p.avatar_url} size={52} /><b>{p.nickname || "여행자"}</b><a href="/friends">친구 보기 <ChevronRight size={16} /></a></div>)}{follows?.length === 0 ? <p>아직 연결된 사람이 없어요.</p> : null}</div></DialogContent></Dialog>
    <Dialog open={!!story} onOpenChange={open => { if (!open) setStory(null) }}><DialogContent className="max-w-md rounded-3xl p-6"><DialogTitle>{story?.title}</DialogTitle>{story ? <><p className="text-sm text-slate-500">나만 보는 기록 · {story.index + 1}/{story.urls.length}</p><img src={story.urls[story.index]} alt="여행 사진" className="max-h-[60dvh] w-full rounded-2xl object-contain" /><div className="flex justify-between"><button disabled={!story.index} onClick={() => setStory({ ...story, index: story.index - 1 })} className="min-h-11 disabled:opacity-30">이전</button><button disabled={story.index === story.urls.length - 1} onClick={() => setStory({ ...story, index: story.index + 1 })} className="min-h-11 disabled:opacity-30">다음</button></div></> : null}</DialogContent></Dialog>
  </div>
}
function RecordCard({ trip, userId, onOpen }: { trip: Trip; userId: string; onOpen: (detail: Detail) => void }) {
  const ref = useRef<HTMLElement>(null)
  const [nearby, setNearby] = useState(false)
  const [active, setActive] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const target = ref.current
    if (!target) return
    const observer = new IntersectionObserver(([entry]) => { setNearby(entry.isIntersecting) }, { rootMargin: "180px" })
    const focus = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: "-42% 0px -42% 0px" })
    observer.observe(target); focus.observe(target)
    return () => { observer.disconnect(); focus.disconnect() }
  }, [])
  useEffect(() => {
    if (!nearby || detail) return
    let alive = true
    const key = `${userId}:${trip.id}`
    let request = detailPromises.get(key)
    if (!request) { request = loadDetail(trip, userId); detailPromises.set(key, request) }
    void request.then(d => { if (alive) { setDetail(d); setFailed(false) } }).catch(() => { detailPromises.delete(key); if (alive) setFailed(true) })
    return () => { alive = false }
  }, [nearby, trip, userId, detail, retry])
  const points = useMemo(() => (detail?.stops ?? []).filter(s => s.lat != null && s.lng != null).map(s => ({ name: s.place_name || "장소", lat: s.lat!, lng: s.lng! })), [detail])
  return <article ref={ref} className={styles.record}><button onClick={() => detail && onOpen(detail)} disabled={!detail} className={styles.recordTitle}><h3>{trip.title}</h3><p>{trip.region} · {trip.nights}박 {trip.days}일{detail ? ` · ${detail.stops.length}곳` : ""}</p></button>
    {detail?.people.length ? <div className={styles.people}><span>함께</span>{detail.people.slice(0, 3).map(p => <span key={p.id}><Avatar uri={p.avatarUrl} /><span>{p.name}</span></span>)}{detail.people.length > 3 ? <small>+{detail.people.length - 3}</small> : null}</div> : null}
    <div className={styles.map}>{nearby && points.length ? <TripRouteMap stops={points} selectedIndex={null} onSelect={() => detail && onOpen(detail)} animateRoute={active} compact /> : <button onClick={() => failed ? (setFailed(false), setRetry(n => n + 1)) : detail && onOpen(detail)}><MapPin size={24} /><span>{failed ? "경로를 불러오지 못했어요 · 다시 시도" : detail ? points.length ? "코스 보기에서 경로를 살펴보세요" : "위치가 등록된 일정이 없어요" : "경로를 불러오는 중…"}</span></button>}</div>
    {points.length ? <p className={styles.stops}>{points.slice(0, 3).map((p, i) => `${i + 1} ${p.name}`).join(" → ")}{points.length > 3 ? ` 외 ${points.length - 3}곳` : ""}</p> : null}
    {detail?.total != null ? <div className={styles.total}><span>총지출</span><b>{detail.totalEstimated ? "약 " : ""}{detail.total.toLocaleString()}원</b></div> : null}
    <div className={styles.cardFooter}><small>내 여행 기록</small><button disabled={!detail} onClick={() => detail && onOpen(detail)}>코스 보기 <ArrowRight size={16} /></button></div>
  </article>
}
function RecordDialog({ value, onClose, onSelectTrip }: { value: { trip: Trip; detail: Detail } | null; onClose: () => void; onSelectTrip: (trip: Trip) => void }) {
  const [day, setDay] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [place, setPlace] = useState<PlaceDetailInput | null>(null)
  const reduced = useReducedMotion()
  useEffect(() => { setDay(value?.detail.stops[0]?.day_number || 1); setSelected(null); setPlace(null) }, [value])
  const days = [...new Set(value?.detail.stops.map(s => s.day_number || 1) ?? [])].sort((a, b) => a - b)
  const stops = useMemo(() => value?.detail.stops.filter(s => (s.day_number || 1) === day) ?? [], [value, day])
  const points = useMemo(() => stops.filter(s => s.lat != null && s.lng != null).map(s => ({ name: s.place_name || "장소", lat: s.lat!, lng: s.lng! })), [stops])
  return <><Dialog open={!!value} onOpenChange={open => { if (!open) { if (place) setPlace(null); else onClose() } }}><DialogContent showCloseButton={false} className="flex h-dvh max-h-dvh w-full max-w-lg flex-col gap-0 rounded-none p-0">
    <header className={styles.recordHeader}><button onClick={onClose} aria-label="프로필로 돌아가기"><ChevronLeft size={24} /></button><span>여행 기록</span></header>
    <div className={styles.recordScroll}>{value ? <><DialogTitle className={styles.recordHeading}>{value.trip.title}</DialogTitle><p className={styles.recordMeta}>{value.trip.region} · {value.trip.nights}박 {value.trip.days}일 · {value.detail.stops.length}곳</p><div className={styles.recordSummary}><div className={styles.people}>{value.detail.people.map(p => <span key={p.id}><Avatar uri={p.avatarUrl} /><span>{p.name}</span></span>)}</div>{value.detail.total != null ? <span><small>총지출</small><b>{value.detail.totalEstimated ? "약 " : ""}{value.detail.total.toLocaleString()}원</b></span> : null}</div><div className={styles.days}>{days.map(d => <button key={d} aria-selected={d === day} onClick={() => { setDay(d); setSelected(null) }}>{d}일차</button>)}</div><div className={styles.map}>{points.length ? <TripRouteMap stops={points} selectedIndex={selected} onSelect={setSelected} compact /> : null}</div><AnimatePresence mode="wait"><motion.div key={day} initial={reduced ? false : { opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: .3 }}><div className={styles.dayTitle}><h3>{day}일차</h3><span>{stops.length}곳</span></div>{stops.map((s, i) => <div key={s.id} className={styles.timeline}><time>{s.visit_time?.slice(0, 5) || "—"}</time><div><i /><small>{s.category}</small><button className={styles.placeName} onClick={() => setPlace({ name: s.place_name || "장소", address: s.address, lat: s.lat, lng: s.lng, category: s.category })}>{s.place_name}<ChevronRight size={17} /></button>{s.address ? <p>{s.address}</p> : null}<footer><button onClick={() => setPlace({ name: s.place_name || "장소", address: s.address, lat: s.lat, lng: s.lng, category: s.category })}>장소와 기록 보기 →</button><DirectionsMenu variant="icon" destination={s.lat != null && s.lng != null ? { name: s.place_name || "장소", lat: s.lat, lng: s.lng } : null} fallbackQuery={s.place_name || ""} /></footer></div></div>)}</motion.div></AnimatePresence></> : null}</div>
    <footer className={styles.recordAction}><button onClick={() => { if (value) onSelectTrip(value.trip); onClose() }}>전체 여행 일정 보기</button></footer>
    <PlaceDetailSheet place={place} onClose={() => setPlace(null)} />
  </DialogContent></Dialog></>
}
