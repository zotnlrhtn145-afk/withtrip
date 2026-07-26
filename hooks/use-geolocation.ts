"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { FALLBACK_LOCATION, GEO_OPTIONS, type LatLng } from "@/lib/geo"

export type GeoStatus = "idle" | "locating" | "ready" | "denied" | "unavailable" | "timeout"

export type GeolocationState = {
  position: LatLng
  accuracy: number | null
  status: GeoStatus
  isFallback: boolean
  errorMessage: string | null
  locate: () => void
}

function mapError(error: GeolocationPositionError): {
  status: GeoStatus
  message: string
} {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return {
        status: "denied",
        message: "위치 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.",
      }
    case error.TIMEOUT:
      return {
        status: "timeout",
        message: "위치 확인 시간이 초과되었어요. 다시 시도해 주세요.",
      }
    default:
      return { status: "unavailable", message: "현재 위치를 가져올 수 없어요." }
  }
}

export function useGeolocation(): GeolocationState {
  const [position, setPosition] = useState<LatLng>(FALLBACK_LOCATION)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [status, setStatus] = useState<GeoStatus>("idle")
  const [isFallback, setIsFallback] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)
  const hasFix = useRef(false)

  const clearWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable")
      setErrorMessage("이 브라우저는 위치 서비스를 지원하지 않아요.")
      setIsFallback(true)
      setPosition(FALLBACK_LOCATION)
      setAccuracy(null)
      return
    }

    setStatus("locating")
    setErrorMessage(null)
    clearWatch()

    const onSuccess = (pos: GeolocationPosition) => {
      hasFix.current = true
      setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      setAccuracy(pos.coords.accuracy)
      setStatus("ready")
      setIsFallback(false)
      setErrorMessage(null)
    }

    const onError = (error: GeolocationPositionError) => {
      if (hasFix.current) return
      const mapped = mapError(error)
      setStatus(mapped.status)
      setErrorMessage(mapped.message)
      setIsFallback(true)
      setPosition(FALLBACK_LOCATION)
      setAccuracy(null)
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, GEO_OPTIONS)
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, GEO_OPTIONS)
  }, [clearWatch])

  useEffect(() => {
    locate()
    return clearWatch
  }, [clearWatch, locate])

  return {
    position,
    accuracy,
    status,
    isFallback,
    errorMessage,
    locate,
  }
}
