"use client"

import { NotificationBellButton } from "@/components/notifications/NotificationBellButton"

/**
 * Back-compat trigger used in page headers.
 * Desktop → slide drawer / Mobile → `/notifications`.
 * Trip navigation after accept is handled by NotificationDrawer / notifications page.
 */
export function NotificationMenu(_props?: {
  onSelectTrip?: (trip: { id: string }) => void
}) {
  return <NotificationBellButton />
}

export const NotificationPopover = NotificationMenu
