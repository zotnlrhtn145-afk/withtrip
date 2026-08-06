"use client"

import { useEffect, useState } from "react"

import { fetchDestinationWeather, type DestinationWeather } from "@/lib/weather"

// 목적지별 캐시 (같은 도시 여러 카드 → 요청 1번)
const cache = new Map<string, DestinationWeather | null>()

function normalize(query: string | null | undefined): string {
  return (query ?? "").split(/[·,]/)[0].trim()
}

/** 여행 목적지 도시명으로 실제 날씨를 가져온다. 실패/없으면 weather=null. */
export function useWeather(query: string | null | undefined) {
  const key = normalize(query)
  const [weather, setWeather] = useState<DestinationWeather | null>(() => cache.get(key) ?? null)
  const [loading, setLoading] = useState(() => !!key && !cache.has(key))

  useEffect(() => {
    if (!key) {
      setWeather(null)
      setLoading(false)
      return
    }
    if (cache.has(key)) {
      setWeather(cache.get(key) ?? null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void fetchDestinationWeather(key).then((w) => {
      cache.set(key, w)
      if (cancelled) return
      setWeather(w)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [key])

  return { weather, loading }
}
