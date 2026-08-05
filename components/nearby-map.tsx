"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Circle,
  Map,
  useMap,
} from "@vis.gl/react-google-maps"
import { Crosshair, LocateFixed, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { type LatLng } from "@/lib/geo"
import {
  DEFAULT_SPOT_AVATAR,
  type NearbySpot,
} from "@/lib/spots-data"
import { cn } from "@/lib/utils"

export type MapSpot = NearbySpot & {
  distanceMeters: number
  distanceLabel: string
}

function googleMapsApiKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  )
}

function googleMapId() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"
  )
}

function MapController({
  center,
  selected,
  recenterKey,
}: {
  center: LatLng
  selected: MapSpot | null
  recenterKey: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || recenterKey === 0) return
    map.panTo({ lat: center.lat, lng: center.lng })
    const zoom = map.getZoom() ?? 15
    if (zoom < 15) map.setZoom(15)
    // Intentionally depend only on recenterKey so GPS watch updates don't yank the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  useEffect(() => {
    if (!map || !selected) return
    map.panTo({ lat: selected.lat, lng: selected.lng })
    const zoom = map.getZoom() ?? 15
    if (zoom < 16) map.setZoom(16)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  return null
}

function ZoomButtons() {
  const map = useMap()

  return (
    <div className="absolute top-3 right-3 z-[2] flex flex-col gap-1.5">
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="확대"
        className="size-9 rounded-xl border border-border bg-card shadow-md"
        onClick={() => map?.moveCamera({ zoom: (map.getZoom() ?? 15) + 1 })}
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="축소"
        className="size-9 rounded-xl border border-border bg-card shadow-md"
        onClick={() => map?.moveCamera({ zoom: (map.getZoom() ?? 15) - 1 })}
      >
        <Minus className="size-4" />
      </Button>
    </div>
  )
}

function UserLocationMarker({ position }: { position: LatLng }) {
  return (
    <AdvancedMarker
      position={position}
      zIndex={1000}
      title="내 위치"
      clickable={false}
    >
      <span className="relative flex size-[22px] items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#ffc107]/45" />
        <span className="relative size-3.5 rounded-full border-[2.5px] border-white bg-[#ffc107] shadow-md" />
      </span>
    </AdvancedMarker>
  )
}

function SpotAvatarPin({
  spot,
  active,
  onSelect,
}: {
  spot: MapSpot
  active: boolean
  onSelect: (id: string) => void
}) {
  const [imgSrc, setImgSrc] = useState(
    spot.authorAvatarUrl?.trim() || DEFAULT_SPOT_AVATAR
  )
  const label =
    spot.authorNickname?.trim() || spot.name

  useEffect(() => {
    setImgSrc(spot.authorAvatarUrl?.trim() || DEFAULT_SPOT_AVATAR)
  }, [spot.authorAvatarUrl])

  return (
    <AdvancedMarker
      position={{ lat: spot.lat, lng: spot.lng }}
      zIndex={active ? 900 : 400}
      title={label}
      onClick={() => onSelect(spot.id)}
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM}
    >
      <div
        aria-label={`${spot.name} — ${label}`}
        className={cn(
          "group flex cursor-pointer flex-col items-center",
          "drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)] transition-transform duration-150",
          active && "scale-110"
        )}
      >
        {/* Pin bubble: circular avatar + speech-pin tip */}
        <span
          className={cn(
            "relative flex size-11 items-center justify-center overflow-hidden rounded-full border-[3px] bg-white transition-[border-color,box-shadow] duration-150",
            active
              ? "border-amber-400 shadow-[0_0_0_3px_rgba(255,193,7,0.45)]"
              : spot.isInterest
                ? "border-sky-400 group-hover:border-sky-300"
                : "border-white group-hover:border-amber-200"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt=""
            className="size-full rounded-full object-cover"
            onError={() => setImgSrc(DEFAULT_SPOT_AVATAR)}
            draggable={false}
          />
        </span>
        {/* Pin tip */}
        <span
          className={cn(
            "-mt-0.5 h-0 w-0 border-x-[7px] border-t-[10px] border-x-transparent transition-colors duration-150",
            active
              ? "border-t-amber-400"
              : spot.isInterest
                ? "border-t-sky-400"
                : "border-t-white"
          )}
          aria-hidden
        />
      </div>
    </AdvancedMarker>
  )
}

function NearbyMapInner({
  center,
  accuracy,
  spots,
  selectedId,
  onSelect,
  onRecenter,
  recenterKey,
  locating,
  fill = false,
  gestureHandling = "greedy",
}: {
  center: LatLng
  accuracy: number | null
  spots: MapSpot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRecenter: () => void
  recenterKey: number
  locating?: boolean
  fill?: boolean
  /** "cooperative"면 마우스 휠 한 번/한 손가락 스와이프는 지도를 확대하지 않고
   *  페이지를 스크롤한다 — 지도가 페이지 스크롤에 얹혀 있는 화면에서 필요하다. */
  gestureHandling?: "greedy" | "cooperative"
}) {
  const selected = useMemo(
    () => spots.find((spot) => spot.id === selectedId) ?? null,
    [selectedId, spots]
  )
  const mapId = googleMapId()

  return (
    <div
      className={cn(
        "relative w-full",
        fill ? "h-full min-h-[16rem]" : "aspect-[4/3] sm:aspect-[16/11]"
      )}
    >      <Map
        className="absolute inset-0 h-full w-full"
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={15}
        minZoom={11}
        maxZoom={20}
        mapId={mapId}
        gestureHandling={gestureHandling}
        disableDefaultUI
        clickableIcons={false}
      >
        <MapController
          center={center}
          selected={selected}
          recenterKey={recenterKey}
        />
        <ZoomButtons />

        {accuracy && accuracy > 0 && accuracy < 800 ? (
          <Circle
            center={{ lat: center.lat, lng: center.lng }}
            radius={accuracy}
            strokeColor="#FFC107"
            strokeOpacity={0.9}
            strokeWeight={1}
            fillColor="#FFC107"
            fillOpacity={0.12}
          />
        ) : null}

        <UserLocationMarker position={center} />

        {spots.map((spot) => (
          <SpotAvatarPin
            key={spot.id}
            spot={spot}
            active={spot.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </Map>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] flex justify-center p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-md backdrop-blur">
          <Crosshair className="size-3.5 text-primary" />
          <span className="text-[11px] font-semibold tabular-nums">
            {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-10">
        <Button
          type="button"
          aria-label="내 현재 위치로 이동"
          title="내 현재 위치로 이동 / 재설정"
          onClick={onRecenter}
          disabled={locating}
          className={cn(
            "flex h-11 items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3.5 text-primary shadow-lg hover:bg-primary/5",
            locating && "animate-pulse"
          )}
        >
          <LocateFixed className="size-5" />
          <span className="text-sm font-bold">{locating ? "찾는 중…" : "내 위치"}</span>
        </Button>
      </div>
    </div>
  )
}

export function NearbyMap({
  center,
  accuracy,
  spots,
  selectedId,
  onSelect,
  onRecenter,
  recenterKey,
  locating,
  className,
  fill = false,
  gestureHandling = "greedy",
}: {
  center: LatLng
  accuracy: number | null
  spots: MapSpot[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRecenter: () => void
  recenterKey: number
  locating?: boolean
  className?: string
  /** Stretch map to parent height instead of fixed aspect ratio. */
  fill?: boolean
  /** "cooperative"면 마우스 휠/한 손가락 스와이프가 지도 확대 대신 페이지 스크롤로 간다. */
  gestureHandling?: "greedy" | "cooperative"
}) {
  const apiKey = googleMapsApiKey()
  const [missingKey] = useState(!apiKey)

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
    },
    [onSelect]
  )

  if (missingKey) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-border bg-card",
          fill && "flex h-full min-h-[16rem] flex-col",
          className
        )}
      >
        <div
          className={cn(
            "flex w-full flex-1 flex-col items-center justify-center gap-2 px-6 text-center",
            fill ? "min-h-[16rem]" : "aspect-[4/3] sm:aspect-[16/11]"
          )}
        >
          <p className="text-sm font-semibold">Google Maps API 키가 필요해요</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            `.env.local`에{" "}
            <code className="rounded bg-secondary px-1 py-0.5">
              NEXT_PUBLIC_GOOGLE_PLACES_API_KEY
            </code>
            를 넣고 Maps JavaScript API를 활성화한 뒤 서버를 재시작해 주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        fill && "flex h-full min-h-[16rem] flex-col",
        className
      )}
    >
      <APIProvider apiKey={apiKey} libraries={["marker"]}>
        <div className={cn(fill && "min-h-0 flex-1")}>
          <NearbyMapInner
            center={center}
            accuracy={accuracy}
            spots={spots}
            selectedId={selectedId}
            onSelect={handleSelect}
            onRecenter={onRecenter}
            recenterKey={recenterKey}
            locating={locating}
            fill={fill}
            gestureHandling={gestureHandling}
          />
        </div>
      </APIProvider>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          프로필 핀 또는 카드를 눌러 연동해 보세요
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2.5 rounded-full border-2 border-sky-400 bg-white" />
            관심 맛집
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" />
            내 위치
          </span>
        </div>
      </div>
    </div>
  )
}
