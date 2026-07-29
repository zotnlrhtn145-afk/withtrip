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
  UserRound,
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
  isAccommodationAuthor,
  type Accommodation,
} from "@/lib/accommodations-api"
import { getCurrentUserId } from "@/lib/auth-session"
import {
  ACCOMMODATION_CARD_BG,
  generateHotelImagePrompt,
  resolveHotelBannerSrc,
} from "@/lib/hotel-image"
import { fetchProfilesByIds, type TripMember } from "@/lib/trip-members-api"

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const TEXT = "#212121"
const MUTED = "#616161"
const ICON = "#424242"
const PANEL = "#F8F9FA"

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

function GuestChip({ member }: { member: TripMember }) {
  const [imgFailed, setImgFailed] = useState(false)
  const initials = (member.name || "?").slice(0, 1)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-2.5 pl-1 text-xs font-medium text-slate-700">
      {member.avatarUrl && !imgFailed ? (
        <img
          src={member.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-5 rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
          {initials}
        </span>
      )}
      <span className="max-w-[72px] truncate">투숙 · {member.name}</span>
    </span>
  )
}

function AccommodationCard({
  item,
  deleting,
  isAuthor,
  guests,
  onEdit,
  onDelete,
}: {
  item: Accommodation
  deleting: boolean
  isAuthor: boolean
  guests: TripMember[]
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
    <li className="group media-card overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
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

        {isAuthor ? (
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
        ) : null}

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
          className="w-fit rounded-full bg-amber-400 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 hover:bg-amber-500"
        >
          <Navigation data-icon="inline-start" />
          길찾기
        </Button>

        {guests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {guests.map((g) => (
              <GuestChip key={g.userId} member={g} />
            ))}
          </div>
        ) : null}
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [memberById, setMemberById] = useState<Map<string, TripMember>>(new Map())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, authId] = await Promise.all([
        fetchAccommodationsByTripId(tripId),
        getCurrentUserId(),
      ])
      setCurrentUserId(authId)
      setItems(data)

      const allGuestIds = [...new Set(data.flatMap((d) => d.guestIds))]
      if (allGuestIds.length > 0) {
        const profiles = await fetchProfilesByIds(allGuestIds)
        const map = new Map<string, TripMember>()
        profiles.forEach((p) => map.set(p.userId, p))
        setMemberById(map)
      }
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
    <Card className="rounded-2xl border border-slate-100 bg-white shadow-sm ring-0 transition-all hover:shadow-md">
      <CardHeader>
        <CardDescription className="mb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
          Stay
        </CardDescription>
        <CardTitle className="text-lg font-bold tracking-tight text-slate-900">숙소 정보</CardTitle>
        {items.length > 0 ? (
          <CardAction>
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              className="rounded-full bg-amber-400 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 hover:bg-amber-500"
            >
              <Plus data-icon="inline-start" />
              숙소 추가
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-amber-500" />
            <p className="text-sm text-slate-500">숙소 정보를 불러오는 중…</p>
          </div>
        ) : items.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <AccommodationCard
                  key={item.id}
                  item={item}
                  deleting={deletingId === item.id}
                  isAuthor={isAccommodationAuthor(item, currentUserId)}
                  guests={item.guestIds.map((id) => memberById.get(id)).filter(Boolean) as TripMember[]}
                  onEdit={openEdit}
                  onDelete={(id) => void handleDelete(id)}
                />
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              onClick={openCreate}
              className="w-full rounded-full border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus data-icon="inline-start" />
              숙소 추가
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <BedDouble className="size-5" />
            </span>
            <p className="text-sm font-bold text-slate-900">아직 등록된 숙소 정보가 없어요</p>
            <p className="mt-1 mb-5 max-w-xs text-xs leading-relaxed text-slate-500">
              체크인·체크아웃만 입력하면 멤버 모두가 함께 확인할 수 있어요.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-full bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-sm shadow-amber-400/20 transition-all hover:bg-amber-500 active:scale-95"
            >
              숙소 등록
            </button>
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
