"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { differenceInHours, format, formatDistanceToNow, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { Loader2, RefreshCw, Search, UserPlus, Users, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
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

/** 카카오톡식 가나다(초성) 그룹핑 — 첫 글자가 한글이면 초성, 영문이면 대문자, 그 외는 "#". */
const CHOSUNG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
]

function groupKeyFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "#"
  const code = trimmed.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const chosungIndex = Math.floor((code - 0xac00) / 588)
    return CHOSUNG_LIST[chosungIndex] ?? "#"
  }
  const upper = trimmed[0].toUpperCase()
  return /[A-Z]/.test(upper) ? upper : "#"
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

type CategoryTab = "list" | "requests"

const CATEGORY_TABS: { key: CategoryTab; label: string; icon: typeof Users }[] = [
  { key: "list", label: "친구 목록", icon: Users },
  { key: "requests", label: "친구 요청", icon: UserPlus },
]

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
  const [activeTab, setActiveTab] = useState<CategoryTab>("list")
  const [animatedItemIds, setAnimatedItemIds] = useState<Set<string>>(() => new Set())
  const [searchExiting, setSearchExiting] = useState(false)
  const [coTravelers, setCoTravelers] = useState<CoTraveler[]>([])

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
      setError("친구 정보를 불러오지 못했어요.")
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

  const sentRequests = useMemo(() => {
    if (!currentUserId) return []
    return friendships
      .filter((row) => row.status === "pending" && row.user_id === currentUserId)
      .slice()
      .sort((a, b) => parseCreatedAt(b.created_at).getTime() - parseCreatedAt(a.created_at).getTime())
  }, [currentUserId, friendships])

  const acceptedFriends = useMemo(() => {
    if (!currentUserId) return []
    return friendships
      .filter((row) => row.status === "accepted")
      .map((row) => ({ row, user: resolveOtherUser(row, currentUserId, usersById) }))
  }, [currentUserId, friendships, usersById])

  /** 친구 목록을 카카오톡식 초성 그룹으로 묶어 보여준다. */
  const groupedFriends = useMemo(() => {
    const groups = new Map<string, typeof acceptedFriends>()
    for (const friend of acceptedFriends) {
      const key = groupKeyFromName(friend.user.nickname)
      const list = groups.get(key)
      if (list) list.push(friend)
      else groups.set(key, [friend])
    }
    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([key, items]) => ({
        key,
        items: items
          .slice()
          .sort((a, b) => a.user.nickname.localeCompare(b.user.nickname, "ko")),
      }))
  }, [acceptedFriends])

  const relationByUserId = useMemo(() => {
    if (!currentUserId) return new Map<string, FriendshipJoinedRow>()
    const map = new Map<string, FriendshipJoinedRow>()
    for (const row of friendships) {
      map.set(otherUserId(row, currentUserId), row)
    }
    return map
  }, [currentUserId, friendships])

  /** 이미 친구인 사람은 "추천"에서 제외 — 친구 목록과 중복 노출하지 않는다. */
  const suggestedCoTravelers = useMemo(
    () => coTravelers.filter((traveler) => relationByUserId.get(traveler.userId)?.status !== "accepted"),
    [coTravelers, relationByUserId]
  )

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
        showToast("친구가 되었어요.")
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
    async (requestId: string, mode: "reject" | "cancel" | "unfriend") => {
      friendshipsSnapshotRef.current = friendships
      setPendingActionId(`${mode}:${requestId}`)

      // Optimistic remove
      setFriendships((prev) => prev.filter((row) => row.id !== requestId))

      try {
        await rejectFriendRequest(requestId)
        void silentRefresh()
        showToast(
          mode === "cancel"
            ? "친구 신청을 취소했어요."
            : mode === "unfriend"
              ? "친구를 삭제했어요."
              : "친구 요청을 거절했어요."
        )
      } catch (err) {
        const typed = err as { message?: string; details?: string; hint?: string }
        console.error("[FriendsView] delete failed:", typed?.message, typed?.details, typed?.hint)
        setFriendships(friendshipsSnapshotRef.current)
        showToast(
          mode === "cancel"
            ? "취소에 실패했어요."
            : mode === "unfriend"
              ? "삭제에 실패했어요."
              : "거절 처리에 실패했어요."
        )
      } finally {
        setPendingActionId(null)
      }
    },
    [friendships, showToast, silentRefresh]
  )

  const handleUnfriend = useCallback(
    (requestId: string, nickname: string) => {
      if (!window.confirm(`${nickname}님을 친구 목록에서 삭제할까요?`)) return
      void handleRejectOrCancel(requestId, "unfriend")
    },
    [handleRejectOrCancel]
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

      // Optimistic UI: 요청됨 상태로 즉시 반영
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

  const requestBadgeCount = receivedRequests.length

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-6 sm:max-w-2xl">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">친구</h2>
          <p className="text-xs text-muted-foreground">친구 목록과 요청 현황을 한눈에 확인하세요</p>
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
          로그인 후 친구 목록을 확인할 수 있어요.
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

      {/* 중카테고리: 친구 목록 / 친구 요청 */}
      {!isSearchMode ? (
        <nav
          aria-label="친구 보기 전환"
          className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1"
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeTab === tab.key
            const badge = tab.key === "requests" ? requestBadgeCount : 0
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all duration-150",
                  isActive
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="size-4 stroke-[1.75]" />
                {tab.label}
                {badge > 0 ? (
                  <span className="ml-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      ) : null}

      {isSearchMode ? null : activeTab === "list" ? (
        <>
          {/* 소카테고리: 추천 (같이 여행 중인 친구) */}
          {suggestedCoTravelers.length > 0 ? (
            <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h3 className="text-sm font-bold">추천 · 같이 여행 중인 친구</h3>
                  <p className="text-xs text-muted-foreground">같은 여행 그룹에 속한 멤버예요</p>
                </div>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {suggestedCoTravelers.length}명
                </span>
              </div>
              <ul className="divide-y divide-border">
                {suggestedCoTravelers.map((traveler) => (
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

          {/* 소카테고리: 전체 친구 목록 (초성 그룹) */}
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold">전체 친구</h3>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {acceptedFriends.length}명
              </span>
            </div>
            {error ? (
              <div className="px-4 py-4">
                <FieldError>{error}</FieldError>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                친구 목록을 불러오는 중…
              </div>
            ) : acceptedFriends.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-full border border-border text-muted-foreground">
                  <Users className="size-7 stroke-[1.25]" />
                </span>
                <p className="text-sm font-semibold">아직 친구가 없어요</p>
                <p className="text-xs text-muted-foreground">
                  위에서 검색해 친구를 추가해보세요.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                {groupedFriends.map((group) => (
                  <div key={group.key}>
                    <p className="px-4 pt-3 pb-1 text-xs font-bold text-muted-foreground">
                      {group.key}
                    </p>
                    <ul>
                      {group.items.map(({ row, user }) => (
                        <li
                          key={row.id}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-secondary/40",
                            animatedItemIds.has(row.id) &&
                              "animate-in fade-in-50 slide-in-from-top-2 duration-300"
                          )}
                        >
                          <Avatar className="size-11 shrink-0">
                            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                            <AvatarFallback className="text-xs font-semibold">
                              {initialsFromName(user.nickname)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">{user.nickname}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.email || user.userId}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-destructive"
                            onClick={() => handleUnfriend(row.id, user.nickname)}
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* 소카테고리: 받은 요청 */}
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold">받은 요청</h3>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {receivedRequests.length}건
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                불러오는 중…
              </div>
            ) : receivedRequests.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                받은 친구 요청이 없어요.
              </p>
            ) : (
              <ul>
                {receivedRequests.map((row) => {
                  const user = currentUserId
                    ? resolveOtherUser(row, currentUserId, usersById)
                    : { userId: row.user_id, nickname: "사용자", email: "" }
                  const accepting = pendingActionId === `accepted:${row.id}`
                  const rejecting = pendingActionId === `reject:${row.id}`
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-secondary/40",
                        animatedItemIds.has(row.id) &&
                          "animate-in fade-in-50 slide-in-from-top-2 duration-300"
                      )}
                    >
                      <span className="shrink-0 rounded-full bg-gradient-to-tr from-primary via-primary to-amber-300 p-[1.5px]">
                        <Avatar className="size-11 border-2 border-card">
                          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs font-semibold">
                            {initialsFromName(user.nickname)}
                          </AvatarFallback>
                        </Avatar>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{user.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatRelativeKo(parseCreatedAt(row.created_at))}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
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
          </section>

          {/* 소카테고리: 보낸 요청 */}
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h3 className="text-sm font-bold">보낸 요청</h3>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {sentRequests.length}건
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                불러오는 중…
              </div>
            ) : sentRequests.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                보낸 친구 요청이 없어요.
              </p>
            ) : (
              <ul>
                {sentRequests.map((row) => {
                  const user = currentUserId
                    ? resolveOtherUser(row, currentUserId, usersById)
                    : { userId: row.friend_id, nickname: "사용자", email: "" }
                  const cancelling = pendingActionId === `cancel:${row.id}`
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-secondary/40",
                        animatedItemIds.has(row.id) &&
                          "animate-in fade-in-50 slide-in-from-top-2 duration-300"
                      )}
                    >
                      <Avatar className="size-11 shrink-0">
                        {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="text-xs font-semibold">
                          {initialsFromName(user.nickname)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{user.nickname}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          대기 중 · {formatRelativeKo(parseCreatedAt(row.created_at))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className={cn(actionBtnClass, "text-muted-foreground")}
                        disabled={cancelling}
                        onClick={() => void handleRejectOrCancel(row.id, "cancel")}
                      >
                        {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : null}
                        취소
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
