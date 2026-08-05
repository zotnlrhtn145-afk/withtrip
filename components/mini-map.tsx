"use client"

import { useEffect } from "react"
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps"

function apiKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  )
}

/** 내 위치가 있으면 장소+내 위치가 모두 보이도록 지도를 맞춘다. */
function Fitter({ lat, lng, user }: { lat: number; lng: number; user?: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !user) return
    map.fitBounds(
      {
        north: Math.max(lat, user.lat),
        south: Math.min(lat, user.lat),
        east: Math.max(lng, user.lng),
        west: Math.min(lng, user.lng),
      },
      48
    )
  }, [map, lat, lng, user])
  return null
}

/** 상세 페이지용 위치 미니 지도 — 확대/축소, 내 위치(가까울 때) 표시. */
export function MiniMap({ lat, lng, user }: { lat: number; lng: number; user?: { lat: number; lng: number } | null }) {
  const key = apiKey()
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return (
    <div className="h-44 w-full overflow-hidden rounded-xl border border-slate-100">
      <APIProvider apiKey={key} libraries={["marker"]}>
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={15}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"}
          zoomControl
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          clickableIcons={false}
          gestureHandling="cooperative"
          className="h-full w-full"
        >
          <Fitter lat={lat} lng={lng} user={user} />
          <AdvancedMarker position={{ lat, lng }}>
            <span className="block size-4 rounded-full border-[3px] border-white bg-amber-400 shadow-md" />
          </AdvancedMarker>
          {user ? (
            <AdvancedMarker position={user} zIndex={999}>
              <span className="block size-4 rounded-full border-[3px] border-white bg-blue-600 shadow-md ring-4 ring-blue-600/25" />
            </AdvancedMarker>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  )
}
