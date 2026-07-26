"use client"

import { CalendarClock, ClipboardList, Settings2, Wallet } from "lucide-react"

import { TripScheduleBoard } from "@/components/trips/TripScheduleBoard"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

export type TripDetailTab = "schedule" | "settlement" | "packing" | "settings"

const TABS: { id: TripDetailTab; label: string; icon: typeof CalendarClock }[] = [
  { id: "schedule", label: "일정표", icon: CalendarClock },
  { id: "settlement", label: "가계부/정산", icon: Wallet },
  { id: "packing", label: "준비물 챙기기", icon: ClipboardList },
  { id: "settings", label: "여행 설정", icon: Settings2 },
]

export function TripDetailTabs({
  activeTab,
  onChange,
}: {
  activeTab: TripDetailTab
  onChange: (tab: TripDetailTab) => void
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      <div
        role="tablist"
        aria-label="여행 상세 메뉴"
        className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 py-2 sm:px-4"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const PLACEHOLDER: Record<
  Exclude<TripDetailTab, "schedule">,
  { title: string; description: string; bullets: string[] }
> = {
  settlement: {
    title: "가계부 / 정산",
    description: "공동 지출을 기록하고 공평하게 나누는 정산 기능이 여기에 들어와요.",
    bullets: ["지출 등록 · 카테고리", "멤버별 정산 요약", "영수증 메모"],
  },
  packing: {
    title: "준비물 챙기기",
    description: "함께 챙길 짐 목록을 체크리스트로 관리할 탭이에요.",
    bullets: ["공용 / 개인 준비물", "담당자 지정", "챙김 완료 체크"],
  },
  settings: {
    title: "여행 설정",
    description: "여행 정보 수정, 멤버 초대, 커버 이미지 변경을 여기서 할 수 있어요.",
    bullets: ["제목 · 기간 · 목적지", "멤버 초대 / 권한", "여행 삭제"],
  },
}

export function TripDetailTabPanel({
  activeTab,
  trip,
}: {
  activeTab: TripDetailTab
  trip: Trip
}) {
  if (activeTab === "schedule") {
    return (
      <div role="tabpanel" className="transition-opacity duration-300">
        <TripScheduleBoard trip={trip} />
      </div>
    )
  }

  const content = PLACEHOLDER[activeTab]

  return (
    <div key={activeTab} role="tabpanel" className="transition-opacity duration-300">
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">준비 중</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight">{content.title}</h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {content.description}
        </p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          {content.bullets.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-border bg-background px-3 py-3 text-sm font-medium text-foreground/80"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
