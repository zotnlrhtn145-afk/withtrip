export type NotificationKind = 'weather' | 'member' | 'flight' | 'schedule'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  body: string
  time: string
  tripId: string
  read: boolean
}

/** Start with no demo notifications — filled as users create real trips. */
export const initialNotifications: AppNotification[] = []
