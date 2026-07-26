export type Friend = {
  id: string
  name: string
  initials: string
  color: string
  email: string
  status: "accepted" | "pending"
  sharedTrips: number
  lastActive: string
}

export const friendsSeed: Friend[] = [
  {
    id: "f1",
    name: "지훈",
    initials: "JH",
    color: "bg-primary text-primary-foreground",
    email: "jihoon@withtrip.kr",
    status: "accepted",
    sharedTrips: 3,
    lastActive: "방금 전",
  },
  {
    id: "f2",
    name: "민서",
    initials: "MS",
    color: "bg-chart-2 text-background",
    email: "minseo@withtrip.kr",
    status: "accepted",
    sharedTrips: 2,
    lastActive: "12분 전",
  },
  {
    id: "f3",
    name: "수아",
    initials: "SA",
    color: "bg-foreground text-background",
    email: "sua@withtrip.kr",
    status: "accepted",
    sharedTrips: 4,
    lastActive: "어제",
  },
  {
    id: "f4",
    name: "현우",
    initials: "HW",
    color: "bg-secondary text-secondary-foreground",
    email: "hyunwoo@withtrip.kr",
    status: "pending",
    sharedTrips: 0,
    lastActive: "초대 대기",
  },
]
