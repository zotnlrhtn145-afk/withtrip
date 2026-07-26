"use client"

import dynamic from "next/dynamic"
import { useEffect, useMemo, useRef, useState } from "react"
import { Footprints, MapPin, Navigation, Star } from "lucide-react"

import { useGeolocation } from "@/hooks/use-geolocation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  distanceMeters,
  estimateWalkMinutes,
  formatDistance,
} from "@/lib/geo"
import { nearbySpots } from "@/lib/spots-data"
import { cn } from "@/lib/utils"

const NearbyMap = dynamic(
  () => import("@/components/nearby-map").then((mod) => mod.NearbyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl border border-border bg-secondary sm:aspect-[16/11]">
        <p className="text-sm text-muted-foreground">고정밀 지도를 불러오는 중…</p>
      </div>
    ),
  }
)

export function SpotsView() {
  const geo = useGeolocation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recenterKey, setRecenterKey] = useState(0)
  const didAutoCenter = useRef(false)
  const followNextFix = useRef(false)
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({})

  const spots = useMemo(() => {
    return nearbySpots
      .map((spot) => {
        const meters = distanceMeters(geo.position, { lat: spot.lat, lng: spot.lng })
        return {
          ...spot,
          distanceMeters: meters,
          distanceLabel: formatDistance(meters),
          walkMinutes: estimateWalkMinutes(meters),
        }
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
  }, [geo.position])

  const selected = spots.find((spot) => spot.id === selectedId) ?? null

  useEffect(() => {
    if (geo.status !== "ready") return
    if (!didAutoCenter.current) {
      didAutoCenter.current = true
      setRecenterKey((key) => key + 1)
      return
    }
    if (followNextFix.current) {
      followNextFix.current = false
      setRecenterKey((key) => key + 1)
    }
  }, [geo.status, geo.position.lat, geo.position.lng])

  useEffect(() => {
    if (!selectedId) return
    cardRefs.current[selectedId]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [selectedId])

  const handleRecenter = () => {
    followNextFix.current = true
    setRecenterKey((key) => key + 1)
    geo.locate()
  }

  const statusLabel = (() => {
    switch (geo.status) {
      case "locating":
        return "고정밀 GPS로 위치를 확인하는 중…"
      case "ready":
        return geo.accuracy
          ? `정확도 ±${Math.round(geo.accuracy)}m · 실시간 추적`
          : "실시간 GPS 추적 중"
      case "denied":
        return "위치 권한 필요 · 오사카 우메다 기준 표시"
      case "timeout":
        return "위치 확인 시간 초과 · 다시 시도해 주세요"
      case "unavailable":
        return "위치 사용 불가 · 오사카 우메다 기준 표시"
      default:
        return "위치 준비 중"
    }
  })()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">주변 스팟</h2>
        <p className="text-sm text-muted-foreground">
          현재 위치 기준으로 등록된 장소를 거리순으로 확인할 수 있어요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-3 py-2.5">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Navigation className={cn("size-4", geo.status === "locating" && "animate-pulse")} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">
            {geo.isFallback ? "오사카 · 우메다 (대체 위치)" : "내 현재 위치"}
          </span>
          <span className="text-xs text-muted-foreground">{statusLabel}</span>
        </div>
        <Badge className="ml-auto font-semibold tabular-nums">{spots.length}곳</Badge>
      </div>

      {geo.errorMessage ? (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          {geo.errorMessage}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <NearbyMap
          center={geo.position}
          accuracy={geo.accuracy}
          spots={spots}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRecenter={handleRecenter}
          recenterKey={recenterKey}
          locating={geo.status === "locating"}
        />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground">거리순</h3>
          <ul className="flex max-h-[min(70vh,640px)] flex-col gap-2 overflow-y-auto pr-0.5">
            {spots.map((spot, index) => {
              const isActive = spot.id === selectedId
              return (
                <li
                  key={spot.id}
                  ref={(node) => {
                    cardRefs.current[spot.id] = node
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(spot.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-secondary/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {index + 1}
                    </span>
                    <div
                      className="size-14 shrink-0 overflow-hidden rounded-xl bg-secondary bg-cover bg-center"
                      style={{ backgroundImage: `url(${spot.image})` }}
                      role="img"
                      aria-label={spot.imageAlt}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{spot.name}</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                          <Star className="size-3 fill-primary text-primary" />
                          {spot.rating}
                        </span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">
                        {spot.category} · {spot.nameLocal}
                      </span>
                      <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground tabular-nums">
                          <MapPin className="size-3 text-primary" />
                          {spot.distanceLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Footprints className="size-3" />
                          도보 {spot.walkMinutes}분
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {selected ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{selected.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.address}</p>
                </div>
                <Badge className="shrink-0 font-semibold tabular-nums">
                  {selected.distanceLabel}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                위도 {selected.lat.toFixed(5)} · 경도 {selected.lng.toFixed(5)} · 도보 약{" "}
                {selected.walkMinutes}분
              </p>
              <Button
                className="mt-3 w-full rounded-full font-semibold"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&origin=${geo.position.lat},${geo.position.lng}&destination=${selected.lat},${selected.lng}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <MapPin data-icon="inline-start" />
                길찾기
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
