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

export const initialNotifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'weather',
    title: '오사카 날씨가 업데이트됐어요',
    body: '8월 29일 교토 지역에 소나기 예보가 있어요. 아라시야마 일정에 우산을 챙기세요.',
    time: '방금 전',
    tripId: 'osaka-kyoto',
    read: false,
  },
  {
    id: 'n2',
    kind: 'member',
    title: '현우 님이 여행에 참여했어요',
    body: '오사카 · 교토 여행에 새 멤버가 합류했습니다. 이제 멤버는 4명이에요.',
    time: '2시간 전',
    tripId: 'osaka-kyoto',
    read: false,
  },
  {
    id: 'n3',
    kind: 'flight',
    title: '항공 정보가 변경됐어요',
    body: 'ICN 09:20 → KIX 11:15 편의 탑승 게이트가 231로 확정되었습니다.',
    time: '어제',
    tripId: 'osaka-kyoto',
    read: false,
  },
  {
    id: 'n4',
    kind: 'schedule',
    title: '다낭 워케이션 일정이 추가됐어요',
    body: '수아 님이 4일차에 호이안 올드타운 야경 투어를 추가했습니다.',
    time: '3일 전',
    tripId: 'danang',
    read: true,
  },
  {
    id: 'n5',
    kind: 'weather',
    title: '타이베이 주간 예보',
    body: '1월 초 타이베이 평균 기온은 18°C로 얇은 겉옷이 필요해요.',
    time: '1주 전',
    tripId: 'taipei',
    read: true,
  },
]
