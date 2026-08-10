"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"

/** 24시간제(00~23시) + 10분 단위 시·분 선택. 값은 "HH:MM" 문자열. */
export function TimeSelect24({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [h = "", m = ""] = (value || "").split(":")

  const minuteOptions = useMemo(() => {
    const base = [0, 10, 20, 30, 40, 50]
    const cur = m ? Number.parseInt(m, 10) : null
    if (cur != null && Number.isFinite(cur) && !base.includes(cur)) {
      return [...base, cur].sort((a, b) => a - b)
    }
    return base
  }, [m])

  const commit = (nextH: string, nextM: string) => {
    if (!nextH && !nextM) {
      onChange("")
      return
    }
    const hh = (nextH || "00").padStart(2, "0")
    const mm = (nextM || "00").padStart(2, "0")
    onChange(`${hh}:${mm}`)
  }

  const selectClass =
    "h-9 flex-1 rounded-xl border border-gray-200 bg-gray-50/80 px-2 text-sm tabular-nums text-gray-900 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <select
        id={id}
        aria-label="시"
        value={h}
        onChange={(event) => commit(event.target.value, m)}
        className={selectClass}
      >
        <option value="">시</option>
        {Array.from({ length: 24 }, (_, i) => {
          const hh = String(i).padStart(2, "0")
          return (
            <option key={hh} value={hh}>
              {hh}시
            </option>
          )
        })}
      </select>
      <select
        aria-label="분"
        value={m}
        onChange={(event) => commit(h, event.target.value)}
        className={selectClass}
      >
        <option value="">분</option>
        {minuteOptions.map((mn) => {
          const mm = String(mn).padStart(2, "0")
          return (
            <option key={mm} value={mm}>
              {mm}분
            </option>
          )
        })}
      </select>
    </div>
  )
}
