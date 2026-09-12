"use client"
import { cn } from "@/lib/utils"
import filterStyles from "./saved-filter.module.css"
export function PlaceChip({
  label,
  count,
  on,
  onClick,
  small,
  icon,
}: {
  label: string
  count?: number
  on: boolean
  onClick: () => void
  small?: boolean
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={filterStyles.option}
    >
      {icon}
      <span className="min-w-0 break-words">{label}</span>
      {count != null ? (
        <span className={cn("tabular-nums", on ? "text-amber-700" : "text-slate-400")}>{count}</span>
      ) : null}
    </button>
  )
}

/** 필터 패널의 한 묶음 — 제목 + 줄바꿈 칩 */
export function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-medium text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100 pb-[18px]">{children}</div>
    </div>
  )
}
