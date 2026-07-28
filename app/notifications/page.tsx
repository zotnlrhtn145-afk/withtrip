"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useNotifications } from "@/components/notifications/notifications-provider"

/**
 * Legacy `/notifications` route — opens the mobile RTL drawer and returns home.
 */
export default function NotificationsPage() {
  const router = useRouter()
  const { openMobileNotifications } = useNotifications()

  useEffect(() => {
    openMobileNotifications()
    router.replace("/")
  }, [openMobileNotifications, router])

  return null
}
