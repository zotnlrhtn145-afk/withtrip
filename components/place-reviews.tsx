"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

/**
 * 가게 리뷰 — **읽기 전용**.
 *
 * ⚠️ 쓰는 건 앱에만 둔다(웹은 읽기, 앱은 쓰기). 리뷰는 다녀온 직후 폰으로 쓰는 것이고,
 *    사진 고르기·압축도 앱이 훨씬 낫다. 웹에 폼을 하나 더 두면 두 곳이 조용히 어긋난다.
 *
 * ⚠️ 위(제목 옆)의 별점은 **구글**, 여기는 **위드트립**이다. 섞으면 둘 다 뜻을 잃는다.
 */

const BUCKET = "review-photos"

type ReviewPhoto = { path: string; thumb: string }

type Row = {
  id: string
  user_id: string
  rating: number
  body: string
  photos: ReviewPhoto[] | null
  visited_on: string | null
  created_at: string
  author?: { nickname: string | null; avatar_url: string | null } | null
}

function photoUrl(path: string | null | undefined): string | undefined {
  const p = String(path ?? "").trim()
  if (!p) return undefined
  if (p.startsWith("http")) return p
  return supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl
}

function ymd(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getMonth() + 1}.${d.getDate()}`
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-200"
          )}
        />
      ))}
    </span>
  )
}

export function PlaceReviews({ googlePlaceId }: { googlePlaceId?: string | null }) {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!googlePlaceId) {
      setRows([])
      return
    }
    let cancelled = false
    void supabase
      .from("place_reviews")
      .select(
        "id, user_id, rating, body, photos, visited_on, created_at, author:profiles!place_reviews_user_id_fkey(nickname, avatar_url)"
      )
      .eq("google_place_id", googlePlaceId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) setRows((data as unknown as Row[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [googlePlaceId])


  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between"><h3 className="text-[19px] font-semibold">위드트립 리뷰</h3><span className="text-[13px] text-slate-500">{rows.length}개의 기록</span></div>
      <div className="flex items-center gap-6 py-7"><span className="text-[40px] leading-[52px] font-semibold">{rows.length ? avg.toFixed(1) : "—"}</span><p className="text-[13px] leading-[21px] text-slate-500">{rows.length ? <>직접 다녀온<br />여행자들의 평가</> : <>아직 여행 기록이 없어요.<br />앱에서 첫 리뷰를 남겨주세요.</>}</p></div>

      {rows.map((r) => {
        const nick = r.author?.nickname?.trim() || "여행자"
        const photos = Array.isArray(r.photos) ? r.photos : []
        return (
          <div key={r.id} className="flex gap-2.5 border-t border-slate-100 py-3.5">
            {r.author?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.author.avatar_url} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-extrabold text-slate-400">
                {nick.charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-extrabold text-slate-900">{nick}</span>
                <span className="text-sm text-slate-600">· {ymd(r.visited_on ?? r.created_at)}</span>
              </div>
              <Stars value={r.rating} className="mt-0.5 [&>svg]:size-[13px]" />
              {r.body ? <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{r.body}</p> : null}
              {photos.length > 0 ? (
                <div className="mt-2 flex gap-1.5 overflow-x-auto">
                  {photos.map((p, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={p.path + i} href={photoUrl(p.path)} target="_blank" rel="noreferrer">
                      <img
                        src={photoUrl(p.thumb)}
                        alt=""
                        className="size-[66px] shrink-0 rounded-lg bg-slate-100 object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      <p className="pt-1 text-sm text-slate-600">리뷰는 앱에서 남길 수 있어요.</p>
    </div>
  )
}
