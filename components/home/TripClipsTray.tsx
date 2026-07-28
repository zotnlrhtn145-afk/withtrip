"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MoreHorizontal, Plus, Trash2, X } from "lucide-react"

import { AddTripClipModal } from "@/components/home/AddTripClipModal"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { deleteTripClip, fetchTripClips, type TripClip } from "@/lib/trip-clips-api"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

export function TripClipsTray({ trips }: { trips: Trip[] }) {
  const router = useRouter()
  const [clips, setClips] = useState<TripClip[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [viewerClip, setViewerClip] = useState<TripClip | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)

  const showNotice = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => {
      setNotice((current) => (current === message ? null : current))
    }, 2200)
  }, [])

  const loadClips = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchTripClips()
      setClips(rows)
    } catch (err) {
      console.error("[TripClipsTray] load failed:", err instanceof Error ? err.message : err)
      setClips([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadClips()
  }, [loadClips])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!cancelled) setCurrentUserId(user?.id ?? null)
      } catch {
        if (!cancelled) setCurrentUserId(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isRedirectingToLogin) return
    const timer = window.setTimeout(() => {
      router.push("/login")
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [isRedirectingToLogin, router])

  useEffect(() => {
    if (!viewerClip) {
      setMenuOpen(false)
      setConfirmOpen(false)
    }
  }, [viewerClip])

  const openAddModal = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setIsRedirectingToLogin(true)
        return
      }
      setAddOpen(true)
    } catch {
      setIsRedirectingToLogin(true)
    }
  }

  const isOwner =
    Boolean(currentUserId) &&
    Boolean(viewerClip?.userId) &&
    currentUserId === viewerClip?.userId

  const handleConfirmDelete = async () => {
    if (!viewerClip || deleting) return
    setDeleting(true)
    try {
      await deleteTripClip(viewerClip.id)
      setConfirmOpen(false)
      setMenuOpen(false)
      setViewerClip(null)
      showNotice("클립이 삭제되었습니다.")
      await loadClips()
    } catch (err) {
      const message = err instanceof Error ? err.message : "클립 삭제에 실패했어요."
      console.error("[TripClipsTray] delete failed:", message)
      showNotice(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <section className="w-full">
        <div className="mb-1 flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Trip Clips
          </p>
          {loading ? (
            <Loader2 className="size-3.5 animate-spin text-amber-500" />
          ) : null}
        </div>

        <div
          className={cn(
            "no-scrollbar flex touch-pan-x items-center space-x-4 overflow-x-auto py-3",
            "-mx-1 px-1"
          )}
        >
          <button
            type="button"
            onClick={() => void openAddModal()}
            className="flex shrink-0 flex-col items-center"
          >
            <span className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-dashed border-amber-400 bg-amber-50/50 shadow-sm transition-all hover:scale-105">
              <Plus className="size-5 text-amber-500" strokeWidth={2.5} />
            </span>
            <span className="mt-1 text-[11px] font-medium text-slate-700">클립 등록</span>
          </button>

          {clips.map((clip) => (
            <button
              key={clip.id}
              type="button"
              onClick={() => setViewerClip(clip)}
              className="flex shrink-0 flex-col items-center"
            >
              <span className="rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-200 p-[2.5px] transition-transform hover:scale-105">
                <span className="block overflow-hidden rounded-full bg-white p-[2px]">
                  {clip.mediaType === "video" ? (
                    <video
                      src={clip.mediaUrl}
                      className="h-16 w-16 rounded-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clip.mediaUrl}
                      alt={clip.caption || clip.tripTitle || "여행 클립"}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  )}
                </span>
              </span>
              <span className="mt-1 max-w-16 truncate text-[11px] font-medium text-slate-700">
                {clip.tripTitle || "클립"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <AddTripClipModal
        open={addOpen}
        onOpenChange={setAddOpen}
        trips={trips}
        onCreated={() => void loadClips()}
      />

      {viewerClip ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => {
            if (confirmOpen || deleting) return
            setViewerClip(null)
          }}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isOwner ? (
              <div className="relative">
                <button
                  type="button"
                  aria-label="더보기"
                  className="rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
                  onClick={(event) => {
                    event.stopPropagation()
                    setMenuOpen((open) => !open)
                  }}
                >
                  <MoreHorizontal className="size-5" />
                </button>
                {menuOpen ? (
                  <div
                    className="absolute top-12 right-0 z-10 w-36 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-semibold text-red-500 transition-all hover:bg-red-50 hover:text-red-600"
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
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation()
                if (confirmOpen || deleting) return
                setViewerClip(null)
              }}
            >
              <X className="size-5" />
            </button>
          </div>

          <div
            className="relative aspect-[9/16] max-h-[85vh] w-full max-w-sm overflow-hidden rounded-3xl bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {viewerClip.mediaType === "video" ? (
              <video
                src={viewerClip.mediaUrl}
                className="size-full object-contain"
                controls
                autoPlay
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewerClip.mediaUrl}
                alt={viewerClip.caption || "여행 클립"}
                className="size-full object-contain"
              />
            )}
            {(viewerClip.caption || viewerClip.tripTitle) && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-5">
                {viewerClip.tripTitle ? (
                  <p className="text-[11px] font-bold tracking-wide text-amber-300 uppercase">
                    {viewerClip.tripTitle}
                  </p>
                ) : null}
                {viewerClip.caption ? (
                  <p className="mt-1 text-sm font-medium text-white">{viewerClip.caption}</p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {confirmOpen && viewerClip ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!deleting) setConfirmOpen(false)
          }}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-center text-sm font-bold text-slate-900">
              이 클립을 삭제하시겠습니까?
            </p>
            <p className="mt-1.5 text-center text-xs text-slate-400">
              삭제하면 되돌릴 수 없어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-full bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="pointer-events-none fixed right-4 bottom-4 z-[100] rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-lg">
          {notice}
        </div>
      ) : null}

      <LoginRedirectOverlay
        open={isRedirectingToLogin}
        message="로그인이 필요한 서비스입니다"
      />
    </>
  )
}
