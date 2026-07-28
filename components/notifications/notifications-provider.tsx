"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  countActionableNotifications,
  fetchFeedNotifications,
  type FeedNotification,
} from "@/lib/notifications-feed"

type NotificationsContextValue = {
  items: FeedNotification[]
  loading: boolean
  unreadCount: number
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  setDrawerOpen: (open: boolean) => void
  refresh: () => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<FeedNotification[]>>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await fetchFeedNotifications()
      setItems(rows)
    } catch (err) {
      console.error(
        "[NotificationsProvider] refresh failed:",
        err instanceof Error ? err.message : err
      )
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onFocus = () => void refresh()
    const onCleared = () => setItems([])
    window.addEventListener("focus", onFocus)
    window.addEventListener("withtrip:session-cleared", onCleared)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("withtrip:session-cleared", onCleared)
    }
  }, [refresh])

  useEffect(() => {
    if (drawerOpen) void refresh()
  }, [drawerOpen, refresh])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      loading,
      unreadCount: countActionableNotifications(items),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      setDrawerOpen,
      refresh,
      setItems,
    }),
    [items, loading, drawerOpen, refresh]
  )

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider")
  }
  return ctx
}
