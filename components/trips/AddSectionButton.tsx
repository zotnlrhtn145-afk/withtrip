import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * 여행 상세 섹션(일정·이동수단·숙소·가고싶은곳)의 '추가' 버튼.
 * 앱(네이티브) 디자인과 동일한 점선 앰버 풀폭 버튼 — 웹/모바일 웹 공통.
 */
export function AddSectionButton({
  label,
  onClick,
  className,
}: {
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-300 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-900 transition-colors hover:bg-amber-50 active:scale-[0.99]",
        className
      )}
    >
      <Plus className="size-5 text-amber-500" strokeWidth={2.5} />
      {label}
    </button>
  )
}
