"use client"

/**
 * 「내 찜 근처 미쉐린」 — 담아 둔 곳 가까이에 미쉐린 가이드에 실린 집.
 *
 * ⚠️ 도시 전체 미쉐린 목록은 어디에나 있다. 여행자가 알고 싶은 건 **"내가
 *    가려는 데서 걸어갈 만한 곳에 뭐가 있나"** 다. 담아 둔 곳이 그 사람의
 *    동선이므로 거기서부터 잰다. (앱의 `trips/michelin.tsx` 와 같은 계산이다)
 *
 * ⚠️ **거리는 직선이다.** 후보마다 길찾기를 부르면 100곳이면 100번이다(돈).
 *    「걸어갈 만한가」만 가르면 되므로 직선으로 충분하다.
 *
 * ⚠️ **등급(1·2·3스타/빕구르망)은 아직 비어 있다.** 아는 건 「실렸다」까지다.
 *    모르는 걸 「셀렉티드」로 적어 두지 않는다 — 나중에 진짜와 구분이 안 된다.
 */

import { Award, ChevronRight, Navigation } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { createClient } from "@/utils/supabase/client"

type Saved = { lat: number; lng: number; place_name: string | null }
type Mich = {
  url: string
  name: string
  address: string | null
  distinction: string | null
  award_year: number | null
  lat: number
  lng: number
}

function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const RANGES = [
  { km: 1, label: "걸어서" },
  { km: 3, label: "3km" },
  { km: 10, label: "10km" },
]

export function MichelinNearby({ tripId }: { tripId: string }) {
  const [saved, setSaved] = useState<Saved[]>([])
  const [rows, setRows] = useState<Mich[]>([])
  const [radiusKm, setRadiusKm] = useState(3)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const db = createClient()
      const { data } = await db
        .from("saved_places")
        .select("lat, lng, place_name")
        .eq("trip_id", tripId)
        .not("lat", "is", null)
      const mine = ((data as Saved[]) ?? []).filter((s) => s.lat != null && s.lng != null)
      if (!alive) return
      setSaved(mine)
      if (mine.length === 0) return

      /* ⚠️ 표를 통째로 받지 않는다 — 찜을 감싸는 네모만 잘라 받는다 */
      const pad = 0.12
      const lats = mine.map((s) => s.lat)
      const lngs = mine.map((s) => s.lng)
      const { data: m } = await db
        .from("michelin_places")
        .select("url, name, address, distinction, award_year, lat, lng")
        .gte("lat", Math.min(...lats) - pad)
        .lte("lat", Math.max(...lats) + pad)
        .gte("lng", Math.min(...lngs) - pad * 1.3)
        .lte("lng", Math.max(...lngs) + pad * 1.3)
      if (alive) setRows((m as Mich[]) ?? [])
    })()
    return () => {
      alive = false
    }
  }, [tripId])

  const near = useMemo(() => {
    return rows
      .map((r) => {
        let best = Infinity
        let who = ""
        for (const s of saved) {
          const d = distKm(s.lat, s.lng, r.lat, r.lng)
          if (d < best) {
            best = d
            who = s.place_name ?? "찜"
          }
        }
        return { ...r, km: best, nearName: who }
      })
      .filter((r) => r.km <= radiusKm)
      .sort((a, b) => a.km - b.km)
  }, [rows, saved, radiusKm])

  const total = useMemo(
    () =>
      rows.filter((r) => saved.some((s) => distKm(s.lat, s.lng, r.lat, r.lng) <= 10)).length,
    [rows, saved]
  )

  /* ⚠️ 없으면 아예 안 그린다. 「0곳」은 알려주는 게 아니라 실망만 준다 */
  if (total === 0) return null

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Award className="size-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-sm font-bold text-amber-800">
          찜 근처 미쉐린 {total}곳
        </span>
        <ChevronRight
          className={`size-4 text-amber-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open ? (
        <div className="px-4 pb-4">
          <div className="mb-3 flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.km}
                type="button"
                onClick={() => setRadiusKm(r.km)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  radiusKm === r.km
                    ? "bg-amber-400 text-zinc-900"
                    : "bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {r.label} {rows.filter((x) => saved.some((s) => distKm(s.lat, s.lng, x.lat, x.lng) <= r.km)).length}
              </button>
            ))}
          </div>

          {near.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">
              이 거리 안에는 없어요. 범위를 넓혀 보세요.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-amber-100">
              {near.map((m) => (
                <li key={m.url} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">{m.name}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      <Award className="size-3" />
                      {m.distinction
                        ? `미쉐린${m.award_year ? ` ${m.award_year}` : ""} · ${m.distinction}`
                        : "미쉐린 가이드"}
                    </p>
                    {/* ⚠️ 「0.4km」만 있으면 무엇으로부터인지 알 수 없다 */}
                    <p className="mt-0.5 truncate text-xs text-zinc-400">
                      {m.nearName}에서{" "}
                      {m.km < 1 ? `${Math.round(m.km * 1000)}m` : `${m.km.toFixed(1)}km`}
                      {m.km <= 1.5 ? ` · 걸어서 ${Math.round((m.km / 4) * 60)}분` : ""}
                    </p>
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 flex-col items-center gap-0.5 text-amber-600 hover:opacity-70"
                  >
                    <Navigation className="size-4" />
                    <span className="text-[10px] font-bold">길찾기</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-center text-xs leading-relaxed text-zinc-400">
            거리는 직선이에요 — 실제로 가는 길은 더 걸릴 수 있어요.
            <br />
            지금은 서울·부산·도쿄·교토·오사카·나라·호치민이 들어 있어요.
          </p>
        </div>
      ) : null}
    </section>
  )
}
