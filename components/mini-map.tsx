"use client"

import { AdvancedMarker, APIProvider, Map } from "@vis.gl/react-google-maps"

function apiKey() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  )
}

/** 상세 페이지용 위치 미니 지도 (핀 1개, 조작 최소). */
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const key = apiKey()
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return (
    <div className="h-40 w-full overflow-hidden rounded-xl border border-slate-100">
      <APIProvider apiKey={key} libraries={["marker"]}>
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={15}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"}
          disableDefaultUI
          clickableIcons={false}
          gestureHandling="cooperative"
          className="h-full w-full"
        >
          <AdvancedMarker position={{ lat, lng }}>
            <span className="block size-4 rounded-full border-[3px] border-white bg-amber-400 shadow-md" />
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  )
}
