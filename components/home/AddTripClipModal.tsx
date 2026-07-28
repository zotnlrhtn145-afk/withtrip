"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { insertTripClip, uploadTripClipMedia } from "@/lib/trip-clips-api"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-400/15"

export function AddTripClipModal({
  open,
  onOpenChange,
  trips,
  onCreated,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  trips: Trip[]
  onCreated?: () => void
}) {
  const fileInputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tripId, setTripId] = useState("")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!open) return
    setCaption("")
    setFile(null)
    setPreviewUrl(null)
    setMediaKind(null)
    setError(null)
    setSaving(false)
    setTripId(trips[0]?.id ?? "")
  }, [open, trips])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const applyFile = useCallback((next: File | null) => {
    setError(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (!next) {
      setFile(null)
      setMediaKind(null)
      return
    }
    const isVideo = next.type.startsWith("video/")
    const isImage = next.type.startsWith("image/")
    if (!isVideo && !isImage) {
      setError("이미지 또는 동영상만 선택할 수 있어요.")
      setFile(null)
      setMediaKind(null)
      return
    }
    setFile(next)
    setMediaKind(isVideo ? "video" : "image")
    setPreviewUrl(URL.createObjectURL(next))
  }, [])

  const handlePublish = async () => {
    if (saving) return
    if (!file) {
      setError("사진이나 영상을 선택해 주세요.")
      return
    }
    if (!tripId) {
      setError("연관 여행을 선택해 주세요.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const uploaded = await uploadTripClipMedia(file)
      await insertTripClip({
        tripId,
        mediaUrl: uploaded.publicUrl,
        caption,
        mediaType: uploaded.mediaType,
      })
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      console.error(
        "[AddTripClipModal] publish failed:",
        err instanceof Error ? err.message : err
      )
      setError(err instanceof Error ? err.message : "클립 게시에 실패했어요.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "max-h-[90svh] w-full max-w-md gap-0 overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl ring-0 backdrop-blur-md"
        )}
      >
        <DialogHeader className="relative mb-4 gap-1 pr-10 text-left">
          <DialogClose className="absolute top-0 right-0 rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" />
            <span className="sr-only">닫기</span>
          </DialogClose>
          <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
            여행 클립 추가
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-slate-400">
            9:16 세로 비율로 사진·영상을 올리고 한 줄 소감을 남겨보세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <input
            ref={fileRef}
            id={fileInputId}
            type="file"
            accept="image/*,video/*"
            className="sr-only"
            onChange={(event) => applyFile(event.target.files?.[0] ?? null)}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              applyFile(event.dataTransfer.files?.[0] ?? null)
            }}
            className={cn(
              "relative flex aspect-[9/16] max-h-[360px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all",
              dragging && "border-amber-400 bg-amber-50/40",
              previewUrl && "border-solid border-slate-100"
            )}
          >
            {previewUrl && mediaKind === "video" ? (
              <video
                src={previewUrl}
                className="absolute inset-0 size-full object-cover"
                muted
                playsInline
                controls
              />
            ) : previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="클립 미리보기"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <>
                <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm">
                  <ImagePlus className="size-5" />
                </span>
                <p className="text-sm font-semibold text-slate-800">사진 · 영상 선택</p>
                <p className="mt-1 text-[11px] text-slate-400">드래그 앤 드롭 또는 클릭</p>
              </>
            )}
          </button>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              연관 여행
            </label>
            <select
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              className={inputClass}
              disabled={trips.length === 0}
            >
              {trips.length === 0 ? (
                <option value="">등록된 여행이 없어요</option>
              ) : (
                trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              한 줄 소감
            </label>
            <input
              type="text"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="오늘 여행의 한 컷을 적어보세요"
              maxLength={120}
              className={inputClass}
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving || trips.length === 0}
            onClick={() => void handlePublish()}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-sm font-bold text-slate-950 shadow-md transition-all hover:bg-amber-500 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "게시 중…" : "클립 게시하기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
