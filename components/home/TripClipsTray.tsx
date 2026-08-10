"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, UserRound } from "lucide-react"

import { AddTripClipModal } from "@/components/home/AddTripClipModal"
import { ClipStoryViewer, type ClipStory } from "@/components/home/ClipStoryViewer"
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
  const [viewerStoryIndex, setViewerStoryIndex] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)

  // 여행별로 클립을 묶어 하나의 스토리로 (인스타그램 스토리처럼).
  const stories = useMemo<ClipStory[]>(() => {
    const map = new Map<string, ClipStory>()
    for (const clip of clips) {
      let story = map.get(clip.tripId)
      if (!story) {
        story = { tripId: clip.tripId, tripTitle: clip.tripTitle || "여행 클립", clips: [] }
        map.set(clip.tripId, story)
      }
      story.clips.push(clip)
    }
    const arr = [...map.values()]
    // fetch는 최신순 → 스토리 재생은 오래된 것부터.
    for (const story of arr) story.clips.reverse()
    return arr
  }, [clips])

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
        const meta = (user?.user_metadata ?? {}) as Record<string, unknown>
        let avatar = String(meta.avatar_url || meta.picture || meta.profile_image || "").trim()
        if (!avatar && user?.id) {
          const { data } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", user.id)
            .maybeSingle()
          avatar = String((data as { avatar_url?: string | null } | null)?.avatar_url ?? "").trim()
        }
        if (!cancelled) {
          setCurrentUserId(user?.id ?? null)
          setCurrentUserAvatar(avatar || null)
        }
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
          <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Trip Clips</p>
          {loading ? <Loader2 className="size-3.5 animate-spin text-amber-500" /> : null}
        </div>

        <div className={cn("no-scrollbar flex touch-pan-x items-start space-x-4 overflow-x-auto py-3", "-mx-1 px-1")}>
          {/* 내 스토리 (클립 등록) — 인스타 '스토리 추가' 스타일 */}
          <button type="button" onClick={() => void openAddModal()} className="flex shrink-0 flex-col items-center">
            <span className="relative transition-transform hover:scale-105">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-2 ring-slate-200">
                {currentUserAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentUserAvatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserRound className="size-6 text-slate-400" />
                )}
              </span>
              <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-white bg-amber-400 shadow-sm">
                <Plus className="size-3.5 text-slate-950" strokeWidth={3} />
              </span>
            </span>
            <span className="mt-1 text-[11px] font-medium text-slate-700">클립 등록</span>
          </button>

          {/* 여행별 스토리 링 */}
          {stories.map((story, index) => {
            const cover = story.clips[story.clips.length - 1]
            return (
              <button
                key={story.tripId}
                type="button"
                onClick={() => setViewerStoryIndex(index)}
                className="flex shrink-0 flex-col items-center"
              >
                <span className="rounded-full bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-200 p-[2.5px] transition-transform hover:scale-105">
                  <span className="block overflow-hidden rounded-full bg-white p-[2px]">
                    {cover.mediaType === "video" ? (
                      <video src={cover.mediaUrl} className="h-16 w-16 rounded-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.mediaUrl} alt={story.tripTitle} className="h-16 w-16 rounded-full object-cover" />
                    )}
                  </span>
                </span>
                <span className="mt-1 flex max-w-16 items-center gap-0.5 truncate text-[11px] font-medium text-slate-700">
                  <span className="truncate">{story.tripTitle}</span>
                  {story.clips.length > 1 ? <span className="text-slate-400">{story.clips.length}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <AddTripClipModal open={addOpen} onOpenChange={setAddOpen} trips={trips} onCreated={() => void loadClips()} />

      {viewerStoryIndex !== null && stories[viewerStoryIndex] ? (
        <ClipStoryViewer
          stories={stories}
          initialStoryIndex={viewerStoryIndex}
          currentUserId={currentUserId}
          onClose={() => setViewerStoryIndex(null)}
          onDeleted={() => void loadClips()}
        />
      ) : null}

      <LoginRedirectOverlay open={isRedirectingToLogin} message="로그인이 필요한 서비스입니다" />
    </>
  )
}
