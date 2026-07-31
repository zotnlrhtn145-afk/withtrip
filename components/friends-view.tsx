"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  differenceInHours,
  format,
  formatDistanceToNow,
  isThisMonth,
  isThisWeek,
  parseISO,
} from "date-fns"
import { ko } from "date-fns/locale"
import { ChevronRight, Heart, Loader2, RefreshCw, Search, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  acceptFriendRequest,
  fetchCoTravelers,
  fetchFriendships,
  profileToUserSummary,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  type CoTraveler,
  type FriendshipJoinedRow,
  type FriendshipRow,
  type UserSummary,
} from "@/lib/friends-api"
import {
  loadRecentSearches,
  removeRecentSearch,
  saveRecentSearches,
  upsertRecentSearch,
  type RecentSearchItem,
} from "@/lib/recent-searches"
import { cn } from "@/lib/utils"
import { createClient } from "@/utils/supabase/client"

const SEARCH_DEBOUNCE_MS = 300

const actionBtnClass =
  "h-8 rounded-lg px-3 text-xs font-semibold transform-gpu transition-all duration-150 ease-in-out active:scale-95 transition-colors duration-200"

type ActivityKind = "received_pending" | "sent_pending" | "accepted"

type ActivityItem = {
  id: string
  kind: ActivityKind
  createdAt: Date
  otherUser: UserSummary
  row: FriendshipJoinedRow
}

function initialsFromName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return trimmed.slice(0, 2).toUpperCase()
}

function otherUserId(row: FriendshipRow, currentUserId: string) {
  return row.user_id === currentUserId ? row.friend_id : row.user_id
}

function toRecentItem(user: UserSummary): RecentSearchItem {
  return {
    id: user.userId,
    nickname: user.nickname,
    email: user.email,
    avatar_url: user.avatarUrl ?? null,
  }
}

function parseCreatedAt(value?: string): Date {
  if (!value) return new Date(0)
  try {
    return parseISO(value)
  } catch {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? new Date(0) : fallback
  }
}

function formatRelativeKo(date: Date) {
  const hours = differenceInHours(new Date(), date)
  if (hours < 24 * 7) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ko })
  }
  return format(date, "M월 d일", { locale: ko })
}

function resolveOtherUser(
  row: FriendshipJoinedRow,
  currentUserId: string,
  usersById: Record<string, UserSummary>
): UserSummary {
  const targetId = otherUserId(row, currentUserId)
  const fromMap = usersById[targetId]
  if (fromMap) return fromMap

  const profile =
    row.user_id === currentUserId
      ? profileToUserSummary(row.friend_profile)
      : profileToUserSummary(row.user_profile)

  return (
    profile ?? {
      userId: targetId,
      nickname: "사용자",
      email: "",
    }
  )
}

function activitySuffix(kind: ActivityKind) {
  if (kind === "received_pending") return "님이 친구 신청을 보냈습니다."
  if (kind === "sent_pending") return "님에게 친구 신청을 보냈습니다."
  return "님과 친구가 되었습니다."
}

export function FriendsView() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<UserSummary[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([])
  const [friendships, setFriendships] = useState<FriendshipJoinedRow[]>([])
  const [usersById, setUsersById] = useState<Record<string, UserSummary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [animatedItemIds, setAnimatedItemIds] = useState<Set<string>>(() => new Set())
  const [searchExiting, setSearchExiting] = useState(false)
  const [coTravelers, setCoTravelers] = useState<CoTraveler[]>([])

  const requestsSectionRef = useRef<HTMLDivElement | null>(null)
  const friendshipsSnapshotRef = useRef<FriendshipJoinedRow[]>([])
  const trimmedQuery = searchQuery.trim()
  const isSearchMode = trimmedQuery.length > 0 && !searchExiting

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current))
    }, 2200)
  }, [])

  useEffect(() => {
    setRecentSearches(loadRecentSearches())
  }, [])

  const addToRecentSearches = useCallback((user: UserSummary | RecentSearchItem) => {
    const item: RecentSearchItem =
      "userId" in user
        ? toRecentItem(user)
        : {
            id: user.id,
            nickname: user.nickname,
            email: user.email,
            avatar_url: user.avatar_url,
          }
    setRecentSearches((prev) => {
      const next = upsertRecentSearch(prev, item)
      saveRecentSearches(next)
      return next
    })
  }, [])

  const clearAllRecent = useCallback(() => {
    setRecentSearches([])
    saveRecentSearches([])
  }, [])

  const removeOneRecent = useCallback((id: string) => {
    setRecentSearches((prev) => {
      const next = removeRecentSearch(prev, id)
      saveRecentSearches(next)
      return next
    })
  }, [])

  const markAnimated = useCallback((id: string) => {
    setAnimatedItemIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    window.setTimeout(() => {
      setAnimatedItemIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 450)
  }, [])

  const silentRefresh = useCallback(async () => {
    const authUserId = currentUserId
    if (!authUserId) return
    try {
      const rows = await fetchFriendships(authUserId)
      setFriendships(rows)
      const nextUsersById: Record<string, UserSummary> = {}
      for (const row of rows) {
        const fromUser = profileToUserSummary(row.user_profile)
        const fromFriend = profileToUserSummary(row.friend_profile)
        if (fromUser?.userId) nextUsersById[fromUser.userId] = fromUser
        if (fromFriend?.userId) nextUsersById[fromFriend.userId] = fromFriend
        if (row.user_id && fromUser) nextUsersById[row.user_id] = { ...fromUser, userId: row.user_id }
        if (row.friend_id && fromFriend) {
          nextUsersById[row.friend_id] = { ...fromFriend, userId: row.friend_id }
        }
      }
      setUsersById((prev) => ({ ...prev, ...nextUsersById }))
    } catch (err) {
      const typed = err as { message?: string; details?: string; hint?: string }
      console.error("[FriendsView] silentRefresh failed:", typed?.message, typed?.details, typed?.hint)
    }
  }, [currentUserId])

  const clearSearchWithAnimation = useCallback(() => {
    if (!searchQuery && searchResults.length === 0) return
    setSearchExiting(true)
    window.setTimeout(() => {
      setSearchQuery("")
      setSearchResults([])
      setSearchError(null)
      setSearchExiting(false)
    }, 220)
  }, [searchQuery, searchResults.length])

  const refreshFriends = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // No session (or missing user) is a normal logged-out state: quiet early return.
    if (!session?.user) {
      setCurrentUserId(null)
      setFriendships([])
      setUsersById({})
      setCoTravelers([])
      setLoading(false)
      setError(null)
      return
    }

    const authUserId = String(session.user.id ?? "").trim() || null
    setCurrentUserId(authUserId)

    if (!authUserId) {
      setFriendships([])
      setUsersById({})
      setCoTravelers([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [rows, travelers] = await Promise.all([
        fetchFriendships(authUserId),
        fetchCoTravelers(authUserId),
      ])
      setFriendships(rows)
      setCoTravelers(travelers)

      const nextUsersById: Record<string, UserSummary> = {}
      for (const row of rows) {
        const fromUser = profileToUserSummary(row.user_profile)
        const fromFriend = profileToUserSummary(row.friend_profile)
        if (fromUser?.userId) nextUsersById[fromUser.userId] = fromUser
        if (fromFriend?.userId) nextUsersById[fromFriend.userId] = fromFriend
        if (row.user_id && fromUser) nextUsersById[row.user_id] = { ...fromUser, userId: row.user_id }
        if (row.friend_id && fromFriend) {
          nextUsersById[row.friend_id] = { ...fromFriend, userId: row.friend_id }
        }
      }
      for (const traveler of travelers) {
        nextUsersById[traveler.userId] = traveler
      }
      setUsersById(nextUsersById)
    } catch (err) {
      const typed = err as { message?: string; details?: string; hint?: string }
      console.error(
        "[FriendsView] refreshFriends failed:",
        typed?.message,
        typed?.details,
        typed?.hint
      )
      setError("활동 내역을 불러오지 못했어요.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshFriends()
  }, [refreshFriends])

  const receivedRequests = useMemo(() => {
    if (!currentUserId) return []
    return friendships
      .filter((row) => row.status === "pending" && row.friend_id === currentUserId)
      .slice()
      .sort((a, b) => parseCreatedAt(b.created_at).getTime() - parseCreatedAt(a.created_at).getTime())
  }, [currentUserId, friendships])

  const activities = useMemo(() => {
    if (!currentUserId) return [] as ActivityItem[]
    return friendships
      .map((row): ActivityItem | null => {
        const createdAt = parseCreatedAt(row.created_at)
        const otherUser = resolveOtherUser(row, currentUserId, usersById)
        if (row.status === "pending" && row.friend_id === currentUserId) {
          return { id: row.id, kind: "received_pending", createdAt, otherUser, row }
        }
        if (row.status === "pending" && row.user_id === currentUserId) {
          return { id: row.id, kind: "sent_pending", createdAt, otherUser, row }
        }
        if (row.status === "accepted") {
          return { id: row.id, kind: "accepted", createdAt, otherUser, row }
        }
        return null
      })
      .filter((item): item is ActivityItem => Boolean(item))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }, [currentUserId, friendships, usersById])

  const groupedActivities = useMemo(() => {
    const now = new Date()
    const fresh: ActivityItem[] = []
    const thisPeriod: ActivityItem[] = []
    const older: ActivityItem[] = []

    for (const item of activities) {
      const hours = differenceInHours(now, item.createdAt)
      if (hours <= 24) {
        fresh.push(item)
      } else if (isThisWeek(item.createdAt) || isThisMonth(item.createdAt)) {
        thisPeriod.push(item)
      } else {
        older.push(item)
      }
    }

    return [
      { key: "fresh", title: "새로운 활동", items: fresh },
      { key: "period", title: "이번 주 / 이번 달", items: thisPeriod },
      { key: "older", title: "이전 활동", items: older },
    ].filter((section) => section.items.length > 0)
  }, [activities])

  const latestRequestUser = useMemo(() => {
    const latest = receivedRequests[0]
    if (!latest || !currentUserId) return null
    return resolveOtherUser(latest, currentUserId, usersById)
  }, [currentUserId, receivedRequests, usersById])

  const runSearch = useCallback(
    async (keyword: string) => {
      const q = keyword.trim()
      if (!q) {
        setSearchResults([])
        setSearchError(null)
        setSearching(false)
        return
      }
      if (!currentUserId) {
        setSearchError("로그인 후 친구 검색을 사용할 수 있어요.")
        setSearchResults([])
        return
      }
      setSearching(true)
      setSearchError(null)
      try {
        setSearchResults(await searchUsers(q, currentUserId))
      } catch (err) {
        const typed = err as { message?: string; details?: string; hint?: string }
        console.error("[FriendsView] search failed:", typed?.message, typed?.details, typed?.hint)
        setSearchError("유저 검색에 실패했어요.")
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    },
    [currentUserId]
  )

  useEffect(() => {
    if (searchExiting) return
    if (!trimmedQuery) {
      setSearchResults([])
      setSearchError(null)
      setSearching(false)
      return
    }
    const timer = window.setTimeout(() => void runSearch(trimmedQuery), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [runSearch, searchExiting, trimmedQuery])

  const handleAccept = useCallback(
    async (requestId: string) => {
      friendshipsSnapshotRef.current = friendships
      setPendingActionId(`accepted:${requestId}`)

      // Optimistic: pending → accepted immediately
      setFriendships((prev) =>
        prev.map((row) =>
          row.id === requestId ? { ...row, status: "accepted" as const, created_at: new Date().toISOString() } : row
        )
      )
      markAnimated(requestId)

      try {
        await acceptFriendRequest(requestId)
        void silentRefresh()
      } catch (err) {
        const typed = err as { message?: string; details?: string; hint?: string }
        console.error("[FriendsView] accept failed:", typed?.message, typed?.details, typed?.hint)
        setFriendships(friendshipsSnapshotRef.current)
        showToast("수락 처리에 실패했어요.")
      } finally {
        setPendingActionId(null)
      }
    },
    [friendships, markAnimated, showToast, silentRefresh]
  )

  const handleRejectOrCancel = useCallback(
    async (requestId: string, mode: "reject" | "cancel") => {
      friendshipsSnapshotRef.current = friendships
      setPendingActionId(`${mode}:${requestId}`)

      // Optimistic remove
      setFriendships((prev) => prev.filter((row) => row.id !== requestId))

      try {
        await rejectFriendRequest(requestId)
        void silentRefresh()
        showToast(mode === "cancel" ? "친구 신청을 취소했어요." : "친구 요청을 거절했어요.")
      } catch (err) {
        const typed = err as { message?: string; details?: string; hint?: string }
        console.error("[FriendsView] delete failed:", typed?.message, typed?.details, typed?.hint)
        setFriendships(friendshipsSnapshotRef.current)
        showToast(mode === "cancel" ? "취소에 실패했어요." : "거절 처리에 실패했어요.")
      } finally {
        setPendingActionId(null)
      }
    },
    [friendships, showToast, silentRefresh]
  )

  const handleSendRequest = useCallback(
    async (target: UserSummary) => {
      if (!currentUserId) {
        showToast("로그인 후 친구 신청을 보낼 수 있어요.")
        return
      }

      addToRecentSearches(target)
      friendshipsSnapshotRef.current = friendships
      const optimisticId = `opt-send:${target.userId}:${Date.now()}`
      const nowIso = new Date().toISOString()

      const optimisticRow: FriendshipJoinedRow = {
        id: optimisticId,
        user_id: currentUserId,
        friend_id: target.userId,
        status: "pending",
        created_at: nowIso,
        friend_profile: {
          id: target.userId,
          nickname: target.nickname,
          email: target.email,
          avatar_url: target.avatarUrl,
        },
      }

      // Optimistic UI: 요청됨 + 타임라인 상단 추가
      setUsersById((prev) => ({ ...prev, [target.userId]: target }))
      setFriendships((prev) => [optimisticRow, ...prev.filter((row) => otherUserId(row, currentUserId) !== target.userId)])
      markAnimated(optimisticId)
      setPendingActionId(`send:${target.userId}`)

      try {
        await sendFriendRequest(currentUserId, target.userId)
        void silentRefresh()
      } catch (err) {
        const typed = err as { message?: string; details?: string; hint?: string }
        console.error(
          "[FriendsView] send request failed:",
          typed?.message,
          typed?.details,
          typed?.hint
        )
        setFriendships(friendshipsSnapshotRef.current)
        showToast("친구 신청 전송에 실패했어요.")
      } finally {
        setPendingActionId(null)
      }
    },
    [addToRecentSearches, currentUserId, friendships, markAnimated, showToast, silentRefresh]
  )

  const openRequestsPanel = () => {
    setRequestsOpen(true)
    window.setTimeout(() => {
      requestsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  const relationByUserId = useMemo(() => {
    if (!currentUserId) return new Map<string, FriendshipJoinedRow>()
    const map = new Map<string, FriendshipJoinedRow>()
    for (const row of friendships) {
      map.set(otherUserId(row, currentUserId), row)
    }
    return map
  }, [currentUserId, friendships])

  const renderSearchAction = (user: UserSummary) => {
    const relation = relationByUserId.get(user.userId)
    const isSending = pendingActionId === `send:${user.userId}`
    const isAccepting = relation ? pendingActionId === `accepted:${relation.id}` : false

    if (relation?.status === "accepted") {
      return (
        <Button
          size="sm"
          variant="secondary"
          disabled
          className={cn(actionBtnClass, "bg-secondary text-muted-foreground")}
        >
          친구
        </Button>
      )
    }
    if (relation?.status === "pending" && relation.user_id === currentUserId) {
      return (
        <Button
          size="sm"
          variant="secondary"
          disabled
          className={cn(actionBtnClass, "bg-secondary text-muted-foreground")}
        >
          {isSending ? <Loader2 className="size-3.5 animate-spin" /> : null}
          요청됨
        </Button>
      )
    }
    if (relation?.status === "pending" && relation.friend_id === currentUserId) {
      return (
        <Button
          size="sm"
          className={cn(
            actionBtnClass,
            "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
          )}
          disabled={isAccepting}
          onClick={() => void handleAccept(relation.id)}
        >
          {isAccepting ? <Loader2 className="size-3.5 animate-spin" /> : null}
          수락
        </Button>
      )
    }
    return (
      <Button
        size="sm"
        className={cn(
          actionBtnClass,
          "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
        )}
        disabled={isSending}
        onClick={() => void handleSendRequest(user)}
      >
        {isSending ? <Loader2 className="size-3.5 animate-spin" /> : null}
        친구 신청
      </Button>
    )
  }

  const renderActivityActions = (item: ActivityItem) => {
    const accepting = pendingActionId === `accepted:${item.id}`
    const rejecting = pendingActionId === `reject:${item.id}`
    const cancelling = pendingActionId === `cancel:${item.id}`

    if (item.kind === "received_pending") {
      return (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            className={cn(
              actionBtnClass,
              "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
            )}
            disabled={accepting || rejecting}
            onClick={() => void handleAccept(item.id)}
          >
            {accepting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            수락
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className={actionBtnClass}
            disabled={accepting || rejecting}
            onClick={() => void handleRejectOrCancel(item.id, "reject")}
          >
            {rejecting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            거절
          </Button>
        </div>
      )
    }

    if (item.kind === "sent_pending") {
      return (
        <Button
          size="sm"
          variant="secondary"
          className={cn(actionBtnClass, "text-muted-foreground")}
          disabled={cancelling}
          onClick={() => void handleRejectOrCancel(item.id, "cancel")}
        >
          {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
          요청됨
        </Button>
      )
    }

    return (
      <Button
        size="sm"
        variant="secondary"
        className={cn(actionBtnClass, "text-muted-foreground")}
        disabled
      >
        친구
      </Button>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-6 sm:max-w-2xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">활동</h2>
          <p className="text-xs text-muted-foreground">친구 요청과 최근 활동을 한눈에 확인하세요</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => void refreshFriends()}
          disabled={loading}
          aria-label="새로고침"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4 stroke-[1.5]" />}
        </Button>
      </div>

      {toast ? (
        <div className="rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-medium">{toast}</div>
      ) : null}

      {!currentUserId && !loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-4 py-8 text-center text-sm text-muted-foreground">
          로그인 후 친구 활동을 확인할 수 있어요.
        </div>
      ) : null}

      {/* Search */}
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="relative border-b border-border px-3 py-2.5">
          <Search className="pointer-events-none absolute top-1/2 left-6 size-3.5 -translate-y-1/2 stroke-[1.5] text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchExiting(false)
              setSearchQuery(event.target.value)
            }}
            placeholder="친구 검색"
            className="h-10 rounded-xl border-0 bg-secondary/70 pr-10 pl-9 shadow-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-primary/40"
            disabled={!currentUserId}
          />
          {searchQuery ? (
            <button
              type="button"
              aria-label="검색어 지우기"
              className="absolute top-1/2 right-5 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 ease-in-out active:scale-95 hover:bg-muted"
              onClick={clearSearchWithAnimation}
            >
              <X className="size-3.5 stroke-[1.5]" />
            </button>
          ) : null}
        </div>

        {isSearchMode || searchExiting ? (
          <div
            className={cn(
              "px-1 pb-2 transition-all duration-300 ease-out",
              searchExiting
                ? "animate-out fade-out-0 slide-out-to-top-2 fill-mode-forwards"
                : "animate-in fade-in-50 slide-in-from-top-2 duration-300"
            )}
          >
            {searchError ? (
              <div className="px-3 py-2">
                <FieldError>{searchError}</FieldError>
              </div>
            ) : null}
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                검색 중…
              </div>
            ) : searchResults.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            ) : (
              <ul className="flex flex-col">
                {searchResults.map((user, index) => (
                  <li
                    key={user.userId}
                    className="flex items-center gap-3 px-3 py-2.5 animate-in fade-in-50 slide-in-from-top-1 duration-300 hover:bg-secondary/50"
                    style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity duration-150 active:opacity-70"
                      onClick={() => addToRecentSearches(user)}
                    >
                      <span className="rounded-full bg-gradient-to-tr from-primary via-primary to-amber-300 p-[1.5px]">
                        <Avatar className="size-11 border-2 border-card">
                          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {initialsFromName(user.nickname)}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{user.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email || user.userId}</p>
                      </div>
                    </button>
                    {renderSearchAction(user)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : recentSearches.length > 0 ? (
          <div className="pb-2">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-bold">최근 검색</p>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:opacity-80"
                onClick={clearAllRecent}
              >
                모두 지우기
              </button>
            </div>
            <ul>
              {recentSearches.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-secondary/50">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => setSearchQuery(item.nickname || item.email)}
                  >
                    <Avatar className="size-10">
                      {item.avatar_url ? <AvatarImage src={item.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {initialsFromName(item.nickname)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{item.nickname}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.email || item.id}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="최근 검색 삭제"
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    onClick={() => removeOneRecent(item.id)}
                  >
                    <X className="size-3.5 stroke-[1.5]" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Co-travelers (Paris group etc.) */}
      {!isSearchMode && coTravelers.length > 0 ? (
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-bold">같이 여행 중인 친구</h3>
              <p className="text-xs text-muted-foreground">같은 여행 그룹에 속한 멤버예요</p>
            </div>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {coTravelers.length}명
            </span>
          </div>
          <ul className="divide-y divide-border">
            {coTravelers.map((traveler) => (
              <li key={traveler.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-11 shrink-0">
                  {traveler.avatarUrl ? <AvatarImage src={traveler.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs font-semibold">
                    {initialsFromName(traveler.nickname)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{traveler.nickname}</p>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      {traveler.groupTag}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {traveler.tripTitle}
                    {traveler.email ? ` · ${traveler.email}` : ""}
                  </p>
                </div>
                {renderSearchAction(traveler)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Friend request banner */}
      {receivedRequests.length > 0 && latestRequestUser ? (
        <button
          type="button"
          onClick={openRequestsPanel}
          className="flex w-full items-center gap-3 rounded-3xl border border-slate-100 bg-white shadow-sm px-4 py-3 text-left transition-all duration-150 ease-in-out active:scale-[0.99] hover:bg-secondary/40"
        >
          <div className="relative flex h-12 w-[3.25rem] shrink-0 items-center">
            {receivedRequests.slice(0, 2).map((row, index) => {
              const user =
                currentUserId != null
                  ? resolveOtherUser(row, currentUserId, usersById)
                  : { userId: row.user_id, nickname: "사용자", email: "" }
              return (
                <Avatar
                  key={row.id}
                  className={cn(
                    "size-11 border-2 border-card",
                    index > 0 && "absolute left-4 top-0.5"
                  )}
                  style={{ zIndex: 2 - index }}
                >
                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-xs font-semibold">
                    {initialsFromName(user.nickname)}
                  </AvatarFallback>
                </Avatar>
              )
            })}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">친구 요청</p>
            <p className="truncate text-xs text-muted-foreground">
              {receivedRequests.length === 1
                ? `${latestRequestUser.nickname}님`
                : `${latestRequestUser.nickname}님 외 ${receivedRequests.length - 1}명`}
            </p>
          </div>

          <span className="flex shrink-0 items-center gap-2">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            <ChevronRight className="size-4 stroke-[1.5] text-muted-foreground" />
          </span>
        </button>
      ) : null}

      {/* Activity feed */}
      <section ref={requestsSectionRef} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {error ? (
          <div className="px-4 py-4">
            <FieldError>{error}</FieldError>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            활동을 불러오는 중…
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-border text-muted-foreground">
              <Heart className="size-7 stroke-[1.25]" />
            </span>
            <p className="text-sm font-semibold">아직 새로운 활동이 없어요</p>
            <p className="text-xs text-muted-foreground">
              친구를 검색하고 신청하면 여기에 활동이 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {groupedActivities.map((section) => (
              <div key={section.key} className="border-b border-border last:border-b-0">
                <div className="px-4 pt-4 pb-1">
                  <h3 className="text-sm font-bold">{section.title}</h3>
                </div>
                <ul>
                  {section.items.map((item) => (
                    <li
                      key={`${item.kind}:${item.id}`}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors duration-200 hover:bg-secondary/40",
                        animatedItemIds.has(item.id) &&
                          "animate-in fade-in-50 slide-in-from-top-2 duration-300"
                      )}
                    >
                      <span className="mt-0.5 shrink-0 rounded-full bg-gradient-to-tr from-primary via-primary to-amber-300 p-[1.5px]">
                        <Avatar className="size-11 border-2 border-card">
                          {item.otherUser.avatarUrl ? (
                            <AvatarImage src={item.otherUser.avatarUrl} alt="" />
                          ) : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {initialsFromName(item.otherUser.nickname)}
                          </AvatarFallback>
                        </Avatar>
                      </span>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm leading-snug text-foreground">
                          <span className="font-bold">{item.otherUser.nickname}</span>
                          <span>{activitySuffix(item.kind)}</span>
                          <span className="text-muted-foreground">
                            {" · "}
                            {formatRelativeKo(item.createdAt)}
                          </span>
                        </p>
                      </div>

                      {renderActivityActions(item)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Received requests modal */}
      <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto rounded-3xl border-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>친구 요청</DialogTitle>
            <DialogDescription>받은 친구 요청을 확인하고 수락하거나 거절하세요.</DialogDescription>
          </DialogHeader>
          {receivedRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">받은 친구 요청이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {receivedRequests.map((row) => {
                const user =
                  currentUserId != null
                    ? resolveOtherUser(row, currentUserId, usersById)
                    : { userId: row.user_id, nickname: "사용자", email: "" }
                const accepting = pendingActionId === `accepted:${row.id}`
                const rejecting = pendingActionId === `reject:${row.id}`
                return (
                  <li key={row.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                    <Avatar className="size-11">
                      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {initialsFromName(user.nickname)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{user.nickname}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email || formatRelativeKo(parseCreatedAt(row.created_at))}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        className={cn(
                          actionBtnClass,
                          "bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                        )}
                        disabled={accepting || rejecting}
                        onClick={() => void handleAccept(row.id)}
                      >
                        {accepting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        수락
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className={actionBtnClass}
                        disabled={accepting || rejecting}
                        onClick={() => void handleRejectOrCancel(row.id, "reject")}
                      >
                        {rejecting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        거절
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
