"use client"

import { Bell, BellOff, CalendarClock, CheckCheck, CloudSun, Plane, UserRoundPlus } from "lucide-react"

import { useTrips } from "@/components/trips-store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import type { NotificationKind } from "@/lib/notifications"
import type { Trip } from "@/lib/trip-data"
import { cn } from "@/lib/utils"

const kindIcons: Record<NotificationKind, typeof CloudSun> = {
  weather: CloudSun,
  member: UserRoundPlus,
  flight: Plane,
  schedule: CalendarClock,
}

export function NotificationMenu({ onSelectTrip }: { onSelectTrip: (trip: Trip) => void }) {
  const { notifications, unreadCount, markAllRead, markRead, trips } = useTrips()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 읽지 않음` : "알림"}
            className="relative"
          />
        }
      >
        <Bell />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-bold text-background tabular-nums">
            {unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] gap-0 p-0 sm:w-88">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-bold">
            알림
            {unreadCount > 0 ? (
              <Badge className="tabular-nums">{unreadCount}</Badge>
            ) : null}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="font-semibold"
          >
            <CheckCheck data-icon="inline-start" />
            모두 읽음
          </Button>
        </div>
        <Separator />

        <ul className="flex max-h-96 flex-col overflow-y-auto p-1.5">
          {notifications.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-3 py-10 text-sm text-muted-foreground">
              <BellOff className="size-5" />
              새로운 알림이 없어요.
            </li>
          ) : null}
          {notifications.map((item) => {
            const Icon = kindIcons[item.kind]
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    markRead(item.id)
                    const trip = trips.find((entry) => entry.id === item.tripId)
                    if (trip) onSelectTrip(trip)
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-secondary",
                    !item.read && "bg-primary/10 hover:bg-primary/15"
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-start gap-1.5">
                      <span className="text-sm leading-snug font-semibold text-pretty">
                        {item.title}
                      </span>
                      {!item.read ? (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                        />
                      ) : null}
                    </span>
                    <span className="text-xs leading-relaxed text-muted-foreground text-pretty">
                      {item.body}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {item.time}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
