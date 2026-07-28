"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, X } from "lucide-react"

import { AddTripClipModal } from "@/components/home/AddTripClipModal"
import { LoginRedirectOverlay } from "@/components/login-redirect-overlay"
import { fetchTripClips, type TripClip } from "@/lib/trip-clips-api"
import { type Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

export function TripClipsTray({ trips }: { trips: Trip[] }) {
  const router = useRouter()
  const [clips, setClips] = useState<TripClip[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [viewerClip, setViewerClip] = useState<TripClip | null>(null)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)

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
    if (!isRedirectingToLogin) return
    const timer = window.setTimeout(() => {
      router.push("/login")
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [isRedirectingToLogin, router])

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

      {/* Lightweight vertical preview — full-screen viewer can plug in here later */}
      {viewerClip ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4"
          onClick={() => setViewerClip(null)}
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white backdrop-blur-md transition hover:bg-white/20"
            onClick={() => setViewerClip(null)}
          >
            <X className="size-5" />
          </button>
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

      <LoginRedirectOverlay
        open={isRedirectingToLogin}
        message="로그인이 필요한 서비스입니다"
      />
    </>
  )
}
