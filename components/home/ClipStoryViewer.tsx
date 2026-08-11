"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, MoreHorizontal, Trash2, X } from "lucide-react"

import { deleteTripClip, type TripClip } from "@/lib/trip-clips-api"

export type ClipStory = { tripId: string; tripTitle: string; clips: TripClip[] }

const IMAGE_MS = 5000

/**
 * 인스타그램 스토리형 클립 뷰어 — 여행별로 묶인 클립을 상단 진행바 + 탭 이동으로 재생.
 * 이미지는 5초 자동 넘김, 영상은 재생 종료 시 넘김. 좌 1/3 이전, 우 2/3 다음.
 */
export function ClipStoryViewer({
  stories,
  initialStoryIndex,
  currentUserId,
  onClose,
  onDeleted,
}: {
  stories: ClipStory[]
  initialStoryIndex: number
  currentUserId: string | null
  onClose: () => void
  onDeleted: () => void
}) {
  const [si, setSi] = useState(initialStoryIndex)
  const [ci, setCi] = useState(0)
  const [progress, setProgress] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  const story = stories[si]
  const clip = story?.clips[ci]
  const isOwner = Boolean(currentUserId && clip?.userId && currentUserId === clip.userId)
  const paused = confirmOpen || menuOpen || deleting

  const goNext = useCallback(() => {
    setMenuOpen(false)
    const cur = stories[si]
    if (cur && ci < cur.clips.length - 1) {
      setCi(ci + 1)
      setProgress(0)
      return
    }
    if (si < stories.length - 1) {
      setSi(si + 1)
      setCi(0)
      setProgress(0)
      return
    }
    onClose()
  }, [si, ci, stories, onClose])

  const goPrev = useCallback(() => {
    setMenuOpen(false)
    setProgress(0)
    if (ci > 0) {
      setCi(ci - 1)
      return
    }
    if (si > 0) {
      const p = si - 1
      setSi(p)
      setCi(Math.max(0, stories[p].clips.length - 1))
    }
  }, [ci, si, stories])

  // 이미지 자동 넘김 (rAF). 영상은 이벤트로 처리.
  useEffect(() => {
    if (!clip || clip.mediaType === "video" || paused) return
    let cancelled = false
    startRef.current = performance.now() - progress * IMAGE_MS
    const tick = (now: number) => {
      if (cancelled) return
      const p = Math.min(1, (now - startRef.current) / IMAGE_MS)
      setProgress(p)
      if (p >= 1) {
        goNext()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [si, ci, paused, clip?.mediaType])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext()
      else if (event.key === "ArrowLeft") goPrev()
      else if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [goNext, goPrev, onClose])

  const handleDelete = async () => {
    if (!clip || deleting) return
    setDeleting(true)
    try {
      await deleteTripClip(clip.id)
      onDeleted()
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  if (!story || !clip) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black p-0 sm:bg-black/95 sm:p-2"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full overflow-hidden bg-black sm:aspect-[9/16] sm:h-auto sm:max-h-[94svh] sm:w-full sm:max-w-sm sm:rounded-2xl sm:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* 인스타 스토리 느낌 — 뒤에 같은 이미지를 흐리게 깔아 화면을 꽉 채운다 */}
        {clip.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            aria-hidden="true"
            src={clip.mediaUrl}
            alt=""
            className="absolute inset-0 z-0 size-full scale-110 object-cover opacity-40 blur-2xl"
          />
        ) : null}

        {/* 진행 바 */}
        <div className="absolute inset-x-0 top-0 z-30 flex gap-1 p-2.5">
          {story.clips.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: i < ci ? "100%" : i === ci ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* 헤더 */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 pt-6">
          <span className="truncate pr-2 text-xs font-bold text-white drop-shadow-sm">
            {story.tripTitle || "여행 클립"}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {isOwner ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="더보기"
                  className="rounded-full bg-white/10 p-1.5 text-white backdrop-blur-md hover:bg-white/20"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <MoreHorizontal className="size-4" />
                </button>
                {menuOpen ? (
                  <div className="absolute top-9 right-0 z-10 w-32 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-500 hover:bg-red-50"
                      onClick={() => {
                        setMenuOpen(false)
                        setConfirmOpen(true)
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      삭제하기
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              aria-label="닫기"
              className="rounded-full bg-white/10 p-1.5 text-white backdrop-blur-md hover:bg-white/20"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 미디어 */}
        {clip.mediaType === "video" ? (
          <video
            key={clip.id}
            src={clip.mediaUrl}
            className="relative z-10 size-full object-contain"
            autoPlay
            playsInline
            onTimeUpdate={(event) => {
              const v = event.currentTarget
              if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration))
            }}
            onEnded={goNext}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={clip.id} src={clip.mediaUrl} alt={clip.caption || "여행 클립"} className="relative z-10 size-full object-contain" />
        )}

        {/* 캡션 */}
        {clip.caption ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-5">
            <p className="text-sm font-medium text-white">{clip.caption}</p>
          </div>
        ) : null}

        {/* 탭 이동 영역 */}
        <button type="button" aria-label="이전" className="absolute inset-y-0 left-0 z-10 w-1/3" onClick={goPrev} />
        <button type="button" aria-label="다음" className="absolute inset-y-0 right-0 z-10 w-2/3" onClick={goNext} />

        {confirmOpen ? (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !deleting && setConfirmOpen(false)}
          >
            <div className="w-full max-w-xs rounded-2xl bg-white p-5" onClick={(event) => event.stopPropagation()}>
              <p className="text-center text-sm font-bold text-slate-900">이 클립을 삭제할까요?</p>
              <p className="mt-1.5 text-center text-xs text-slate-400">삭제하면 되돌릴 수 없어요.</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-full bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete()}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  삭제
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
