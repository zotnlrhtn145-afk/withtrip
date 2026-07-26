"use client"

import { Monitor, Smartphone } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ViewMode = "mobile" | "desktop"

export function ViewSwitcher({
  view,
  onViewChange,
  className,
}: {
  view: ViewMode
  onViewChange: (view: ViewMode) => void
  className?: string
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      value={[view]}
      onValueChange={(value) => {
        const next = value[0] as ViewMode | undefined
        if (next) onViewChange(next)
      }}
      aria-label="화면 미리보기 전환"
      className={className}
    >
      <ToggleGroupItem value="mobile" aria-label="모바일 뷰">
        <Smartphone data-icon="inline-start" />
        모바일
      </ToggleGroupItem>
      <ToggleGroupItem value="desktop" aria-label="데스크탑 뷰">
        <Monitor data-icon="inline-start" />
        웹
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
