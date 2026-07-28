"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { NotificationList } from "@/components/notifications/NotificationList"

export default function NotificationsPage() {
  const router = useRouter()

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-white md:max-w-2xl">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur md:px-5">
        <button
          type="button"
          aria-label="뒤로가기"
          onClick={() => {
            if (window.history.length > 1) router.back()
            else router.push("/")
          }}
          className="flex size-9 items-center justify-center rounded-full text-slate-700 transition-all hover:bg-slate-100"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-base font-bold tracking-tight text-slate-900">알림</h1>
      </header>

      <main className="px-4 py-4 md:px-5">
        <NotificationList
          onSelectTrip={(trip) => {
            router.push(`/trips/${trip.id}`)
          }}
        />
      </main>
    </div>
  )
}
