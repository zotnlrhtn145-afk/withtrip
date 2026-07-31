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
import { usePathname } from "next/navigation"

import {
  countActionableNotifications,
  fetchFeedNotifications,
  type FeedNotification,
} from "@/lib/notifications-feed"

type NotificationsContextValue = {
  items: FeedNotification[]
  loading: boolean
  unreadCount: number
  /** Desktop left slide drawer */
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  setDrawerOpen: (open: boolean) => void
  /** Mobile right-to-left full-screen drawer */
  isMobileNotificationOpen: boolean
  openMobileNotifications: () => void
  closeMobileNotifications: () => void
  setMobileNotificationOpen: (open: boolean) => void
  refresh: () => Promise<void>
  setItems: React.Dispatch<React.SetStateAction<FeedNotification[]>>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [items, setItems] = useState<FeedNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isMobileNotificationOpen, setMobileNotificationOpen] = useState(false)

  // Close both notification drawers whenever the route changes (e.g. clicking
  // another sidebar category while the drawer is open) instead of leaving the
  // bell lit and the drawer parked over the new page.
  useEffect(() => {
    setDrawerOpen(false)
    setMobileNotificationOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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
    if (drawerOpen || isMobileNotificationOpen) void refresh()
  }, [drawerOpen, isMobileNotificationOpen, refresh])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      items,
      loading,
      unreadCount: countActionableNotifications(items),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      setDrawerOpen,
      isMobileNotificationOpen,
      openMobileNotifications: () => setMobileNotificationOpen(true),
      closeMobileNotifications: () => setMobileNotificationOpen(false),
      setMobileNotificationOpen,
      refresh,
      setItems,
    }),
    [items, loading, drawerOpen, isMobileNotificationOpen, refresh]
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
