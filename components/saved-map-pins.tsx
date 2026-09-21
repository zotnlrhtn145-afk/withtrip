"use client"

import { MapPin } from "lucide-react"
import { PlaceAwardMarks } from "./place-award-marks"
import { useEffect, useMemo, useRef, useState } from "react"
import { AdvancedMarker, AdvancedMarkerAnchorPoint, useMap } from "@vis.gl/react-google-maps"
import { SavedDesignIcon } from "./saved-place-card"
import styles from "./saved-exact.module.css"
import { inMapViewport } from "@/shared/map-viewport"
import type { MapSpot } from "./nearby-map"

type Group = { id: string; lat: number; lng: number; spots: MapSpot[] }
type Viewport = { north: number; south: number; west: number; east: number; zoom: number }
/** Approx. 44 screen pixels per bucket, recalculated only when the camera settles. */
export function groupSavedPins(spots: MapSpot[], viewport: Viewport | null): Group[] {
  if (!viewport) return []
  const zoom = viewport.zoom
  const cell = 44 / (256 * 2 ** zoom)
  const groups = new Map<string, Group>()
  for (const spot of spots) {
    if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) continue
    if (!inMapViewport(spot, viewport)) continue
    const sin = Math.sin(Math.max(-85, Math.min(85, spot.lat)) * Math.PI / 180)
    const x = (spot.lng + 180) / 360, y = .5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
    const key = `${Math.floor(x / cell)}:${Math.floor(y / cell)}`
    const existing = groups.get(key)
    if (existing) { const count = existing.spots.length; existing.lat = (existing.lat * count + spot.lat) / (count + 1); existing.lng = (existing.lng * count + spot.lng) / (count + 1); existing.spots.push(spot) }
    else groups.set(key, { id: key, lat: spot.lat, lng: spot.lng, spots: [spot] })
  }
  return [...groups.values()]
}

/** The real map owns projection/pan. The popup remains a compact list above the selected pin. */
export function SavedMapPins({ spots, selectedId, onSelect, onDetail }: { spots: MapSpot[]; selectedId: string | null; onSelect: (id: string) => void; onDetail?: (id: string) => void }) {
  const map = useMap(), [viewport, setViewport] = useState<Viewport | null>(null), [popup, setPopup] = useState<Group | null>(null)
  const clicked = useRef<string | null>(null), [popupVisible, setPopupVisible] = useState(20)
  useEffect(() => {
    if (!map) return
    const update = () => { const b = map.getBounds(); if (!b) return; setViewport({ north: b.getNorthEast().lat(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), west: b.getSouthWest().lng(), zoom: map.getZoom() ?? 15 }) }
    update()
    const idle = map.addListener("idle", update), drag = map.addListener("dragstart", () => setPopup(null))
    return () => { idle.remove(); drag.remove() }
  }, [map])
  useEffect(() => {
    if (!selectedId) { clicked.current = null; setPopup(null); return }
    if (clicked.current === selectedId) return
    const spot = spots.find(item => item.id === selectedId)
    if (!spot) return
    clicked.current = selectedId
    setPopupVisible(20)
    setPopup({ id: spot.id, lat: spot.lat, lng: spot.lng, spots: [spot] })
    map?.panTo({ lat: spot.lat, lng: spot.lng })
  }, [selectedId, spots, map])
  const groups = useMemo(() => groupSavedPins(spots, viewport), [spots, viewport])
  const spotIds = useMemo(() => new Set(spots.map(spot => spot.id)), [spots])
  const popupSpots = popup?.spots.filter(spot => spotIds.has(spot.id)) ?? []
  const popupShift = (() => {
    const projection = map?.getProjection(), center = map?.getCenter()
    if (!map || !popup || !projection || !center) return { x: 0, y: 0 }
    const at = projection.fromLatLngToPoint(new google.maps.LatLng(popup.lat, popup.lng)), origin = projection.fromLatLngToPoint(center)
    if (!at || !origin) return { x: 0, y: 0 }
    const scale = 2 ** (map.getZoom() ?? 15), width = map.getDiv().clientWidth
    let deltaX = at.x - origin.x
    if (deltaX > 128) deltaX -= 256
    if (deltaX < -128) deltaX += 256
    const x = width / 2 + deltaX * scale, y = map.getDiv().clientHeight / 2 + (at.y - origin.y) * scale
    const popupHeight = 40 + Math.min(204, popupSpots.length * 98) + (popupSpots.length > 1 ? 40 : 0)
    return { x: Math.max(12, Math.min(width - 237, x - 112.5)) - (x - 112.5), y: Math.max(0, 82 - (y - popupHeight - 25)) }
  })()
  const choose = (group: Group) => { setPopupVisible(20); setPopup(group); if (group.spots.length === 1) { clicked.current = group.spots[0].id; onSelect(group.spots[0].id) } }
  return <>{groups.map((group, index) => <AdvancedMarker key={`${group.id}:${group.spots.length}:${group.spots[0].id}`} position={{ lat: group.lat, lng: group.lng }} anchorPoint={AdvancedMarkerAnchorPoint.CENTER} zIndex={popup?.id === group.id ? 900 : 400} onClick={() => choose(group)}>
    <button className={styles.mapPin} data-active={group.spots.some(spot => spot.id === selectedId)} aria-label={group.spots.length > 1 ? `장소 ${group.spots.length}곳 보기` : group.spots[0].name} style={{ position:"relative", animationDelay: `${Math.min(index, 8) * 24}ms`, ...(group.spots.length === 1 && (group.spots[0].awards?.worldBest || group.spots[0].awards?.michelin) ? {width:54,height:54,overflow:"visible",borderColor:"#FBBF24"} : {}) }}>
      {group.spots.length > 1 ? <b>{group.spots.length > 999 ? "999+" : group.spots.length}곳</b> : <>
        <span style={{position:"absolute",inset:0,borderRadius:"50%",overflow:"hidden",display:"grid",placeItems:"center"}}><MapPin size={22}/>{group.spots[0].image ? <img src={group.spots[0].image} alt="" style={{position:"absolute",width:"100%",height:"100%",objectFit:"cover"}} onError={event=>{event.currentTarget.style.display="none"}}/> : null}</span>
        {group.spots[0].awards && (group.spots[0].awards.worldBest || group.spots[0].awards.michelin) ? <span style={{position:"absolute",top:"calc(100% + 4px)",left:"50%",transform:"translateX(-50%)",background:"white",borderRadius:12,padding:"4px 6px",whiteSpace:"nowrap",boxShadow:"0 2px 7px #17253620"}}><PlaceAwardMarks compact awards={group.spots[0].awards}/></span> : null}
      </>}
    </button>
  </AdvancedMarker>)}
  {popup && popupSpots.length ? <AdvancedMarker position={{ lat: popup.lat, lng: popup.lng }} anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER} zIndex={1100} clickable={false}>
    <div className={`${styles.popup} ${styles.anchoredPopup}`} style={{ translate: `${popupShift.x}px ${popupShift.y}px` }}><header>{popupSpots.length > 1 ? `이곳에 ${popupSpots.length}곳` : "장소 미리보기"}<button aria-label="장소 팝업 닫기" onClick={() => setPopup(null)}><SavedDesignIcon name="x" size={15} /></button></header><div className={styles.popupList}>{popupSpots.slice(0, popupVisible).map(spot => <button key={spot.id} className={styles.popupRow} onClick={() => onDetail?.(spot.id)}>{spot.image ? <img src={spot.image} alt="" /> : <SavedDesignIcon name="heart" size={28} />}<span><b>{spot.name}</b>{spot.awards ? <PlaceAwardMarks awards={spot.awards}/> : null}<small>{spot.category}{spot.distanceLabel ? ` · ${spot.distanceLabel}` : ""}</small></span><SavedDesignIcon name="chevron-right" size={13} /></button>)}{popupSpots.length > popupVisible ? <button className={styles.popupZoom} onClick={() => setPopupVisible(value => value + 20)}>다음 장소 보기 · {popupSpots.length - popupVisible}곳</button> : null}</div>{popupSpots.length > 1 ? <button className={styles.popupZoom} onClick={() => { const bounds = new google.maps.LatLngBounds(); popupSpots.forEach(spot => bounds.extend({ lat: spot.lat, lng: spot.lng })); map?.fitBounds(bounds, { top: 90, left: 35, right: 80, bottom: 150 }); setPopup(null) }}>지도 확대해서 보기<SavedDesignIcon name="chevron-right" size={13} /></button> : null}</div>
  </AdvancedMarker> : null}</>
}
