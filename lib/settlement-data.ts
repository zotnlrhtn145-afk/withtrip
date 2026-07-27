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

export function formatWon(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원"
}

/** @deprecated Seed data kept for reference only. Use settlements-api. */
export const expensesSeed: Expense[] = []
export const transfersSeed: Transfer[] = []
