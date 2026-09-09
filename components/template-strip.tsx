"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { FALLBACK_TRIP_COVER, CITY_IMAGES, withUnsplashQuality } from "@/shared/city-images"
import type { TemplateCard } from "@/lib/templates-api"

/**
 * 홈 상단 「인기 여행 템플릿」 한 줄 — 큰 방(/templates)으로 들어가는 문.
 *
 * ⚠️ 템플릿이 하나도 없으면 **줄 자체가 안 보인다** — 빈 진열대를 걸어 두지 않는다.
 * ⚠️ 카드 등장은 줄줄이 시차(55ms) — 목업 확정 움직임.
 */
export function TemplateStrip() {
  const [cards, setCards] = useState<TemplateCard[] | null>(null)

  useEffect(() => {
    let alive = true
    void fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cards?: TemplateCard[] } | null) => {
        if (alive) setCards(j?.cards ?? [])
      })
      .catch(() => {
        if (alive) setCards([])
      })
    return () => {
      alive = false
    }
  }, [])

  if (!cards || cards.length === 0) return null

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Templates</p>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">인기 여행 템플릿</h2>
        </div>
        <Link
          href="/templates"
          className="flex items-center gap-0.5 rounded-full px-2 py-1 text-[13px] font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          전체 보기 <ChevronRight className="size-3.5" />
        </Link>
      </div>
      <div className="scrollbar-none -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {cards.slice(0, 8).map((c, i) => {
          const cover =
            c.coverImage ||
            (c.city && CITY_IMAGES[c.city] ? withUnsplashQuality(CITY_IMAGES[c.city]) : FALLBACK_TRIP_COVER)
          return (
            <Link
              key={c.id}
              href={`/templates/${encodeURIComponent(c.slug)}`}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both w-36 shrink-0 overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]"
              style={{ animationDelay: `${Math.min(i * 55, 330)}ms` }}
            >
              <div className="relative h-16 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute bottom-1.5 left-2 text-[10.5px] font-extrabold text-white drop-shadow">
                  {c.city ?? ""}
                </span>
              </div>
              <div className="p-2">
                <p className="line-clamp-2 text-[12px] font-extrabold leading-snug text-foreground">{c.title}</p>
                <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                  📍 {c.stopCount}곳{c.duration ? ` · ${c.duration}` : ""}
                  {c.forkCount > 0 ? <span className="text-amber-600"> · 🔥 {c.forkCount}</span> : null}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
