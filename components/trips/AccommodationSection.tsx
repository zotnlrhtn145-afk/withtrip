"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BedDouble,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Navigation,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Trash2,
} from "lucide-react"

import { AccommodationRegisterModal } from "@/components/trips/AccommodationRegisterModal"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  deleteAccommodation,
  fetchAccommodationsByTripId,
  formatStayDuration,
  type Accommodation,
} from "@/lib/accommodations-api"
import {
  ACCOMMODATION_CARD_BG,
  generateHotelImagePrompt,
  resolveHotelBannerSrc,
} from "@/lib/hotel-image"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const TEXT = "#212121"
const MUTED = "#616161"
const ICON = "#424242"
const PANEL = "#F8F9FA"
const YELLOW_BTN = "#FFD54F"

function formatStamp(dateValue: string, timeValue: string) {
  const match = String(dateValue ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return [dateValue, timeValue].filter(Boolean).join(" ")
  }
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const date = new Date(y, m - 1, d)
  const weekday = WEEKDAYS[date.getDay()] ?? ""
  const dateLabel = `${`${m}`.padStart(2, "0")}.${`${d}`.padStart(2, "0")} (${weekday})`
  return timeValue ? `${dateLabel} ${timeValue}` : dateLabel
}

function AccommodationCard({
  item,
  deleting,
  onEdit,
  onDelete,
}: {
  item: Accommodation
  deleting: boolean
  onEdit: (item: Accommodation) => void
  onDelete: (id: string) => void
}) {
  const duration = formatStayDuration(item.checkInDate, item.checkOutDate)
  const bannerSrc = resolveHotelBannerSrc(item.name)
  const imagePrompt = generateHotelImagePrompt(item.name, {
    cardBackground: ACCOMMODATION_CARD_BG,
  })
  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    item.address || item.name
  )}`

  return (
    <li
      className="group media-card overflow-hidden rounded-2xl ring-1 ring-border"
      style={{ backgroundColor: ACCOMMODATION_CARD_BG }}
    >
      {/* Banner — natural cool night tones, no sepia wash */}
      <div className="relative h-[132px] w-full overflow-hidden bg-[#E9ECEF]">
        <img
          src={bannerSrc}
          alt={`${item.name} 숙소`}
          data-ai-prompt={imagePrompt}
          className="media-card-image absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden"
          }}
        />
        {/* Subtle cool scrim for title legibility only */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
        />

        <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-0.5 p-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="숙소 수정"
            disabled={deleting}
            onClick={() => onEdit(item)}
            className="bg-white/90 text-[#212121] backdrop-blur-sm hover:bg-white hover:text-black"
          >
            <Pencil className="text-[#424242]" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="숙소 삭제"
            disabled={deleting}
            onClick={() => onDelete(item.id)}
            className="bg-white/90 text-[#212121] backdrop-blur-sm hover:bg-white hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="animate-spin text-[#424242]" />
            ) : (
              <Trash2 className="text-[#424242]" />
            )}
          </Button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
          <p className="min-w-0 flex-1 truncate text-lg font-extrabold text-white drop-shadow-sm">
            {item.name}
          </p>
          {duration ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-bold text-white tabular-nums backdrop-blur-sm">
              <Moon aria-hidden="true" className="size-3" />
              {duration}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative flex flex-col gap-3 px-5 pt-3 pb-5" style={{ color: TEXT }}>
        {item.address ? (
          <p className="flex items-start gap-1.5 text-sm" style={{ color: MUTED }}>
            <MapPin className="mt-0.5 size-3.5 shrink-0" style={{ color: ICON }} />
            <span className="text-pretty">{item.address}</span>
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div
            className="flex flex-col gap-1 rounded-xl p-3 ring-1 ring-[#E9ECEF]"
            style={{ backgroundColor: PANEL }}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: MUTED }}>
              <LogIn className="size-3.5" style={{ color: ICON }} />
              체크인
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: TEXT }}>
              {formatStamp(item.checkInDate, item.checkInTime)}
            </span>
          </div>
          <div
            className="flex flex-col gap-1 rounded-xl p-3 ring-1 ring-[#E9ECEF]"
            style={{ backgroundColor: PANEL }}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: MUTED }}>
              <LogOut className="size-3.5" style={{ color: ICON }} />
              체크아웃
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: TEXT }}>
              {formatStamp(item.checkOutDate, item.checkOutTime)}
            </span>
          </div>
        </div>

        {item.phoneNumber ? (
          <p className="flex items-center gap-1.5 text-sm">
            <Phone className="size-3.5 shrink-0" style={{ color: ICON }} />
            <span style={{ color: MUTED }}>전화번호</span>
            <a
              href={`tel:${item.phoneNumber.replace(/[^\d+]/g, "")}`}
              className="font-semibold tabular-nums underline-offset-4 hover:underline"
              style={{ color: TEXT }}
            >
              {item.phoneNumber}
            </a>
          </p>
        ) : null}

        {item.memo ? (
          <p
            className="flex items-start gap-1.5 rounded-xl px-3 py-2.5 text-sm ring-1 ring-[#E9ECEF]"
            style={{ backgroundColor: PANEL, color: MUTED }}
          >
            <NotebookPen className="mt-0.5 size-3.5 shrink-0" style={{ color: ICON }} />
            <span className="text-pretty">{item.memo}</span>
          </p>
        ) : null}

        <Button
          render={<a href={mapHref} target="_blank" rel="noreferrer" />}
          nativeButton={false}
          size="sm"
          className="w-fit rounded-full font-semibold text-[#212121] hover:brightness-95"
          style={{ backgroundColor: YELLOW_BTN }}
        >
          <Navigation data-icon="inline-start" className="text-[#212121]" />
          길찾기
        </Button>
      </div>
    </li>
  )
}

/**
 * Supabase `trip_accommodations` 연동 숙소·호텔 섹션.
 */
export function AccommodationSection({
  tripId,
  tripStartDate = "",
  tripEndDate = "",
}: {
  tripId: string
  tripStartDate?: string
  tripEndDate?: string
}) {
  const [items, setItems] = useState<Accommodation[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Accommodation | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAccommodationsByTripId(tripId)
      setItems(data)
    } catch (err) {
      console.error("[AccommodationSection] load failed:", err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: Accommodation) => {
    setEditing(item)
    setModalOpen(true)
  }

  const handleModalOpenChange = (next: boolean) => {
    setModalOpen(next)
    if (!next) setEditing(null)
  }

  const handleDelete = async (id: string) => {
    const target = items.find((item) => item.id === id)
    const label = target?.name ? `"${target.name}"` : "이 숙소"
    if (!window.confirm(`${label} 정보를 삭제할까요?`)) return

    setDeletingId(id)
    try {
      const ok = await deleteAccommodation(id)
      if (ok) setItems((current) => current.filter((item) => item.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <BedDouble className="size-3.5" />
          숙소 · 호텔
        </CardDescription>
        <CardTitle className="text-lg font-bold">숙소 정보</CardTitle>
        {items.length > 0 ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openCreate}
              className="rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              숙소 추가
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">숙소 정보를 불러오는 중…</p>
          </div>
        ) : items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <AccommodationCard
                  key={item.id}
                  item={item}
                  deleting={deletingId === item.id}
                  onEdit={openEdit}
                  onDelete={(id) => void handleDelete(id)}
                />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              onClick={openCreate}
              className="w-full rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              숙소 추가
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border",
              "bg-secondary/40 px-6 py-10 text-center"
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <BedDouble className="size-6" />
            </span>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-bold">아직 등록된 숙소 정보가 없어요.</p>
              <p className="text-xs text-muted-foreground">
                체크인·체크아웃만 입력하면 멤버 모두가 함께 확인할 수 있어요.
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              onClick={openCreate}
              className="w-full max-w-xs rounded-full font-semibold"
            >
              <Plus data-icon="inline-start" />
              숙소 등록
            </Button>
          </div>
        )}
      </CardContent>

      <AccommodationRegisterModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        tripId={tripId}
        editing={editing}
        defaultCheckInDate={tripStartDate}
        defaultCheckOutDate={tripEndDate}
        onSaved={() => {
          void load()
        }}
      />
    </Card>
  )
}
