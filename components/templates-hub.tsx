"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

import { FALLBACK_TRIP_COVER, CITY_IMAGES, withUnsplashQuality } from "@/shared/city-images"
import { FLAGS } from "@/shared/country-flags"
import { TRIP_THEMES } from "@/shared/trip-templates"
import type { TemplateCard } from "@/lib/templates-api"
import { cn } from "@/lib/utils"

/**
 * 템플릿 둘러보기 — 큰 방 하나 + 칩.
 *
 * ⚠️ 페이지를 잘게 쪼개지 않는다. 템플릿 20개일 때 나라×기간×테마로 나누면
 *    빈 진열대 투성이가 된다. 칩으로 그 자리에서 거른다.
 * ⚠️ 칩 전환 움직임: 훅 꺼졌다(190ms) → 걸러서 → 다시 떠오름. 목업 확정안.
 */
export function TemplatesHub({ cards }: { cards: TemplateCard[] }) {
  const [nation, setNation] = useState("all")
  const [theme, setTheme] = useState("all")
  const [traveledOnly, setTraveledOnly] = useState(false)
  const [fading, setFading] = useState(false)
  const [pending, setPending] = useState<{ n: string; t: string; v: boolean } | null>(null)

  const nations = useMemo(() => {
    const seen = new Map<string, number>()
    for (const c of cards) if (c.countryCode) seen.set(c.countryCode, (seen.get(c.countryCode) ?? 0) + 1)
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code)
  }, [cards])

  const themes = useMemo(() => {
    const used = new Set(cards.flatMap((c) => c.themes.map((t) => t.key)))
    return TRIP_THEMES.filter((t) => used.has(t.key))
  }, [cards])

  /* 훅 꺼졌다 다시 떠오르는 전환 — 상태를 바로 바꾸지 않고 190ms 뒤에 */
  function switchTo(next: { n?: string; t?: string; v?: boolean }) {
    const target = { n: next.n ?? nation, t: next.t ?? theme, v: next.v ?? traveledOnly }
    setPending(target)
    setFading(true)
    setTimeout(() => {
      setNation(target.n)
      setTheme(target.t)
      setTraveledOnly(target.v)
      setFading(false)
      setPending(null)
    }, 190)
  }

  const chipN = pending?.n ?? nation
  const chipT = pending?.t ?? theme
  const chipV = pending?.v ?? traveledOnly

  const shown = cards.filter(
    (c) =>
      (nation === "all" || c.countryCode === nation) &&
      (theme === "all" || c.themes.some((t) => t.key === theme)) &&
      (!traveledOnly || c.traveled)
  )

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-background px-4 pb-16">
      <header className="animate-in fade-in slide-in-from-bottom-2 pt-7 duration-500">
        <h1 className="text-[22px] font-black tracking-tight text-foreground">여행 일정 템플릿</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">검색하지 말고, 복제해서 시작하세요</p>
      </header>

      {/* 나라 칩 */}
      <div className="scrollbar-none -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4">
        <Chip on={chipN === "all"} dark onClick={() => switchTo({ n: "all" })}>
          전체
        </Chip>
        {nations.map((code) => (
          <Chip key={code} on={chipN === code} dark onClick={() => switchTo({ n: code })}>
            {FLAGS[code]?.name ?? code}
          </Chip>
        ))}
      </div>

      {/* 테마 칩 + 다녀온 코스만 */}
      <div className="scrollbar-none -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
        <Chip on={chipT === "all"} onClick={() => switchTo({ t: "all" })}>
          전체
        </Chip>
        {themes.map((t) => (
          <Chip key={t.key} on={chipT === t.key} onClick={() => switchTo({ t: t.key })}>
            {t.emoji} {t.label}
          </Chip>
        ))}
        <Chip on={chipV} onClick={() => switchTo({ v: !traveledOnly })}>
          ✈️ 다녀온 코스만
        </Chip>
      </div>

      {/* 카드 진열대 */}
      <div
        className={cn(
          "mt-4 grid grid-cols-2 gap-3 transition-opacity duration-200",
          fading ? "pointer-events-none opacity-0" : "opacity-100"
        )}
      >
        {shown.map((c, i) => (
          <TemplateCardView key={c.id} card={c} index={i} />
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">이 조건의 템플릿이 아직 없어요</p>
      ) : null}
    </div>
  )
}

/** 도시 허브 — 검색어("도쿄 여행 일정")가 꽂히는 자리. 서버에서 글자로 그려진다 */
export function CityHub({ city, cards }: { city: string; cards: TemplateCard[] }) {
  const cover = CITY_IMAGES[city] ? withUnsplashQuality(CITY_IMAGES[city]) : FALLBACK_TRIP_COVER
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg bg-background pb-16">
      <div className="relative h-40 w-full overflow-hidden sm:rounded-b-3xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={`${city} 풍경`} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <h1 className="text-2xl font-black tracking-tight drop-shadow-md">
            {city} 여행 일정 <span className="text-sm font-bold text-white/80">{cards.length}개</span>
          </h1>
        </div>
      </div>
      <p className="px-4 pt-3 text-[13px] leading-relaxed text-muted-foreground">
        {city} 템플릿 {cards.length}개 — 실제로 다녀온 일정에서 만들었습니다. 장소마다 시간·길찾기가 붙어 있고, 복제하면
        바로 내 여행이 됩니다.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        {cards.map((c, i) => (
          <TemplateCardView key={c.id} card={c} index={i} />
        ))}
      </div>
    </div>
  )
}

function Chip({
  children,
  on,
  dark,
  onClick,
}: {
  children: React.ReactNode
  on: boolean
  dark?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition-all active:scale-95",
        on
          ? dark
            ? "border-foreground bg-foreground text-primary"
            : "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-foreground/25"
      )}
    >
      {children}
    </button>
  )
}

function TemplateCardView({ card, index }: { card: TemplateCard; index: number }) {
  const cover =
    card.coverImage || (card.city && CITY_IMAGES[card.city] ? withUnsplashQuality(CITY_IMAGES[card.city]) : FALLBACK_TRIP_COVER)
  return (
    <Link
      href={`/templates/${encodeURIComponent(card.slug)}`}
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both group overflow-hidden rounded-2xl border border-border bg-card transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
      style={{ animationDelay: `${Math.min(index * 55, 440)}ms` }}
    >
      <div className="relative flex h-20 items-end overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="relative p-2 text-[11px] font-extrabold text-white drop-shadow">{card.city ?? ""}</span>
        {card.traveled ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-black/40 px-2 py-0.5 text-[9.5px] font-black text-white backdrop-blur-sm">
            ✈️ 다녀온 코스
          </span>
        ) : null}
      </div>
      <div className="p-2.5">
        <p className="line-clamp-2 text-[13px] font-extrabold leading-snug text-foreground">{card.title}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.themes.slice(0, 2).map((t) => (
            <span key={t.key} className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-extrabold text-secondary-foreground">
              {t.emoji} {t.label}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
          <span>
            📍 {card.stopCount}곳{card.duration ? ` · ${card.duration}` : ""}
          </span>
          {card.forkCount > 0 ? <span className="text-amber-600">🔥 {card.forkCount}</span> : null}
        </div>
      </div>
    </Link>
  )
}
