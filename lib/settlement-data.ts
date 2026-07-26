export type Expense = {
  id: string
  title: string
  category: string
  amount: number
  paidBy: string
  paidByInitials: string
  splitWith: string[]
  date: string
}

export type Transfer = {
  id: string
  from: string
  fromInitials: string
  to: string
  toInitials: string
  amount: number
  status: "pending" | "done"
}

export const expensesSeed: Expense[] = [
  {
    id: "e1",
    title: "호텔 숙박비",
    category: "숙소",
    amount: 480000,
    paidBy: "지훈",
    paidByInitials: "JH",
    splitWith: ["지훈", "민서", "수아", "현우"],
    date: "08.27",
  },
  {
    id: "e2",
    title: "Kigawa 저녁",
    category: "식사",
    amount: 168000,
    paidBy: "민서",
    paidByInitials: "MS",
    splitWith: ["지훈", "민서", "수아", "현우"],
    date: "08.27",
  },
  {
    id: "e3",
    title: "하루카 특급",
    category: "교통",
    amount: 92000,
    paidBy: "수아",
    paidByInitials: "SA",
    splitWith: ["지훈", "민서", "수아", "현우"],
    date: "08.27",
  },
  {
    id: "e4",
    title: "Hajime 런치",
    category: "식사",
    amount: 320000,
    paidBy: "지훈",
    paidByInitials: "JH",
    splitWith: ["지훈", "민서"],
    date: "08.28",
  },
  {
    id: "e5",
    title: "편의점 · 간식",
    category: "기타",
    amount: 28400,
    paidBy: "현우",
    paidByInitials: "HW",
    splitWith: ["지훈", "민서", "수아", "현우"],
    date: "08.28",
  },
]

export const transfersSeed: Transfer[] = [
  {
    id: "t1",
    from: "민서",
    fromInitials: "MS",
    to: "지훈",
    toInitials: "JH",
    amount: 154600,
    status: "pending",
  },
  {
    id: "t2",
    from: "수아",
    fromInitials: "SA",
    to: "지훈",
    toInitials: "JH",
    amount: 89600,
    status: "pending",
  },
  {
    id: "t3",
    from: "현우",
    fromInitials: "HW",
    to: "민서",
    toInitials: "MS",
    amount: 42100,
    status: "done",
  },
]

export function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원"
}
