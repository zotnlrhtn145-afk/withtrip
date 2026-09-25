"use client"
import { GoogleMapPermit } from "./google-map-permit"

import { useEffect } from "react"
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps"

import { cn } from "@/lib/utils"

function apiKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  )
}

export type RouteStop = {
  name: string
  lat: number
  lng: number
}

/** 그 날의 동선을 담도록 맞춘다 — Day 를 바꿀 때마다 */
function DayFitter({ stops, compact = false }: { stops: RouteStop[]; compact?: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!map || stops.length === 0) return
    if (stops.length === 1) {
      map.panTo({ lat: stops[0].lat, lng: stops[0].lng })
      map.setZoom(15)
      return
    }
    map.fitBounds(
      {
        north: Math.max(...stops.map((s) => s.lat)),
        south: Math.min(...stops.map((s) => s.lat)),
        east: Math.max(...stops.map((s) => s.lng)),
        west: Math.min(...stops.map((s) => s.lng)),
      },
      compact ? 18 : 72
    )
  }, [map, stops, compact])
  return null
}

/** 고른 일정으로 살짝 이동 */
function SelectPan({ stop }: { stop: RouteStop | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !stop) return
    map.panTo({ lat: stop.lat, lng: stop.lng })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.lat, stop?.lng])
  return null
}

/**
 * 동선 선 — @vis.gl 에는 Polyline 컴포넌트가 없어 직접 얹는다.
 * 앱과 같은 문법: 흰 밑선 + 앰버 선 두 겹(도로·강과 안 섞이게).
 */
function RouteLine({ stops, animate = true }: { stops: RouteStop[]; animate?: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!map || stops.length < 2) return
    const path = stops.map((s) => ({ lat: s.lat, lng: s.lng }))
    const casing = new google.maps.Polyline({
      path,
      map,
      strokeColor: "#ffffff",
      strokeOpacity: 0.95,
      strokeWeight: 8,
    })
    const line = new google.maps.Polyline({
      path,
      map,
      strokeColor: "#f59e0b",
      strokeOpacity: 0.95,
      strokeWeight: 4.5,
    })
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    let start: number | null = null
    const finish = () => { cancelAnimationFrame(frame); casing.setPath(path); line.setPath(path) }
    const draw = (now: number) => {
      if (document.hidden || media.matches) { finish(); return }
      start ??= now
      const progress = Math.min(1, (now - start) / 850)
      const cursor = (1 - Math.pow(1 - progress, 3)) * (path.length - 1)
      const index = Math.floor(cursor)
      const partial = path.slice(0, index + 1)
      if (index < path.length - 1) {
        const a = path[index], b = path[index + 1], t = cursor - index
        partial.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })
      }
      casing.setPath(partial); line.setPath(partial)
      if (progress < 1) frame = requestAnimationFrame(draw)
    }
    if (animate && !media.matches && !document.hidden) frame = requestAnimationFrame(draw)
    document.addEventListener("visibilitychange", finish)
    media.addEventListener("change", finish)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("visibilitychange", finish)
      media.removeEventListener("change", finish)
      casing.setMap(null)
      line.setMap(null)
    }
  }, [map, stops, animate])
  return null
}

/**
 * 공개 뷰어의 오른쪽 절반 지도 (회의 확정: "웹에서는 지도를 오른쪽편에 절반정도").
 *
 * 번호 핀 = 타임라인 순번과 같은 숫자. 핀을 누르면 왼쪽 목록의 그 줄이,
 * 줄을 누르면 이 핀이 서로를 가리킨다.
 */
export function TripRouteMap({
  stops,
  selectedIndex,
  onSelect,
  animateRoute = true,
  compact = false,
}: {
  animateRoute?: boolean
  compact?: boolean
  stops: RouteStop[]
  selectedIndex: number | null
  onSelect: (index: number) => void
}) {
  const key = apiKey()
  if (!key || stops.length === 0) return null
  return (
    <GoogleMapPermit><APIProvider apiKey={key} libraries={["marker"]}>
      <Map
        defaultCenter={{ lat: stops[0].lat, lng: stops[0].lng }}
        defaultZoom={13}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"}
        zoomControl={!compact}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        gestureHandling={compact ? "none" : "greedy"}
        className="h-full w-full"
      >
        <DayFitter stops={stops} compact={compact} />
        <SelectPan stop={selectedIndex != null ? (stops[selectedIndex] ?? null) : null} />
        <RouteLine stops={stops} animate={animateRoute} />
        {stops.map((s, i) => (
          <AdvancedMarker key={`${s.lat},${s.lng},${i}`} position={{ lat: s.lat, lng: s.lng }} onClick={() => onSelect(i)}>
            {/* 번호 핀 — 앱의 NumberPin 과 같은 문법(앰버 원+흰 테두리+꼬리) */}
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid place-items-center rounded-full border-[2.5px] border-white font-black text-slate-900 shadow-md transition-all",
                  selectedIndex === i ? "size-9 bg-slate-900 text-[15px] text-amber-300" : "size-8 bg-amber-400 text-[13px]"
                )}
              >
                {i + 1}
              </span>
              <span className="-mt-px block size-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-white" />
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider></GoogleMapPermit>
  )
}
