"use client"

import { useEffect, useMemo } from "react"
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import { Crosshair, LocateFixed, Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { type LatLng } from "@/lib/geo"
import { type NearbySpot } from "@/lib/spots-data"
import { cn } from "@/lib/utils"

import "leaflet/dist/leaflet.css"

export type MapSpot = NearbySpot & {
  distanceMeters: number
  distanceLabel: string
}

const MAP_STYLES = `
.withtrip-user-marker,
.withtrip-spot-marker {
  background: transparent !important;
  border: none !important;
}
.wt-user-pulse {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: color-mix(in oklab, #ffc107 45%, transparent);
  animation: wt-pulse 1.8s ease-out infinite;
}
.wt-user-dot {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  border-radius: 9999px;
  background: #ffc107;
  border: 2.5px solid #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.35);
}
.wt-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  transition: transform 0.15s ease;
}
.wt-pin.is-active {
  transform: scale(1.12);
}
.wt-pin-bubble {
  display: flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: #fff;
  color: #1a1a1a;
  font-size: 12px;
  font-weight: 800;
  border: 2px solid #e5e5e5;
}
.wt-pin.is-active .wt-pin-bubble {
  background: #ffc107;
  border-color: #ffc107;
  color: #1a1a1a;
}
.wt-pin-stem {
  width: 2px;
  height: 10px;
  background: rgba(26, 26, 26, 0.45);
  margin-top: -1px;
}
@keyframes wt-pulse {
  0% { transform: scale(0.7); opacity: 0.85; }
  100% { transform: scale(2.4); opacity: 0; }
}
.leaflet-container {
  font: inherit;
  background: #e8efe6;
  width: 100%;
  height: 100%;
}
.leaflet-control-attribution {
  font-size: 10px !important;
  background: rgba(255, 255, 255, 0.85) !important;
}
`

function createUserIcon() {
  return L.divIcon({
    className: "withtrip-user-marker",
    html: `<span class="wt-user-pulse"></span><span class="wt-user-dot"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function createSpotIcon(index: number, active: boolean) {
  return L.divIcon({
    className: "withtrip-spot-marker",
    html: `
      <div class="wt-pin ${active ? "is-active" : ""}">
        <span class="wt-pin-bubble">${index + 1}</span>
        <span class="wt-pin-stem"></span>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
  })
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
    const frame = requestAnimationFrame(() => map.invalidateSize())
    return () => cancelAnimationFrame(frame)
  }, [map])

  useEffect(() => {
    if (recenterKey === 0) return
    map.flyTo([center.lat, center.lng], Math.max(map.getZoom(), 15), {
      duration: 0.75,
    })
    // Intentionally depend only on recenterKey so GPS watch updates don't yank the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  useEffect(() => {
    if (!selected) return
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), {
      duration: 0.6,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  return null
}

function ZoomButtons() {
  const map = useMap()

  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="확대"
        className="size-9 rounded-xl border border-border bg-card shadow-md"
        onClick={() => map.zoomIn()}
      >
        <Plus className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="secondary"
        aria-label="축소"
        className="size-9 rounded-xl border border-border bg-card shadow-md"
        onClick={() => map.zoomOut()}
      >
        <Minus className="size-4" />
      </Button>
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
}) {
  const selected = useMemo(
    () => spots.find((spot) => spot.id === selectedId) ?? null,
    [selectedId, spots]
  )
  const meIcon = useMemo(() => createUserIcon(), [])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        className
      )}
    >
      <style dangerouslySetInnerHTML={{ __html: MAP_STYLES }} />

      <div className="relative aspect-[4/3] w-full sm:aspect-[16/11]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={15}
          minZoom={11}
          maxZoom={19}
          scrollWheelZoom
          zoomControl={false}
          className="absolute inset-0 z-0 h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            maxNativeZoom={19}
            detectRetina
          />
          <MapController center={center} selected={selected} recenterKey={recenterKey} />
          <ZoomButtons />

          {accuracy && accuracy > 0 && accuracy < 800 ? (
            <Circle
              center={[center.lat, center.lng]}
              radius={accuracy}
              pathOptions={{
                color: "#FFC107",
                fillColor: "#FFC107",
                fillOpacity: 0.12,
                weight: 1,
              }}
            />
          ) : null}

          <Marker
            position={[center.lat, center.lng]}
            icon={meIcon}
            zIndexOffset={1000}
            interactive={false}
          />

          {spots.map((spot, index) => (
            <Marker
              key={`${spot.id}-${spot.id === selectedId ? "on" : "off"}`}
              position={[spot.lat, spot.lng]}
              icon={createSpotIcon(index, spot.id === selectedId)}
              eventHandlers={{
                click: () => onSelect(spot.id),
              }}
              zIndexOffset={spot.id === selectedId ? 800 : 400}
            />
          ))}
        </MapContainer>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-center p-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-md backdrop-blur">
            <Crosshair className="size-3.5 text-primary" />
            <span className="text-[11px] font-semibold tabular-nums">
              {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
            </span>
          </div>
        </div>

        <div className="absolute bottom-3 right-3 z-[1000]">
          <Button
            type="button"
            size="icon"
            aria-label="내 현재 위치로 이동"
            title="내 현재 위치로 이동 / 재설정"
            onClick={onRecenter}
            disabled={locating}
            className={cn(
              "size-11 rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-secondary",
              locating && "animate-pulse"
            )}
          >
            <LocateFixed
              className={cn("size-5", locating ? "text-muted-foreground" : "text-primary")}
            />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground">마커 또는 카드를 눌러 연동해 보세요</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" />
          내 위치
        </span>
      </div>
    </div>
  )
}
