"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Plus, Receipt, Users } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  expensesSeed,
  formatWon,
  transfersSeed,
  type Expense,
  type Transfer,
} from "@/lib/settlement-data"
import { cn } from "@/lib/utils"

const payers = [
  { name: "지훈", initials: "JH" },
  { name: "민서", initials: "MS" },
  { name: "수아", initials: "SA" },
  { name: "현우", initials: "HW" },
]

export function SettlementView() {
  const [expenses, setExpenses] = useState<Expense[]>(expensesSeed)
  const [transfers] = useState<Transfer[]>(transfersSeed)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("식사")
  const [paidBy, setPaidBy] = useState(payers[0].name)

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  )
  const memberCount = payers.length
  const perPerson = Math.round(total / memberCount)

  const resetForm = () => {
    setTitle("")
    setAmount("")
    setCategory("식사")
    setPaidBy(payers[0].name)
  }

  const handleAddExpense = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = Number(amount.replace(/,/g, ""))
    if (!title.trim() || !Number.isFinite(parsed) || parsed <= 0) return

    const payer = payers.find((item) => item.name === paidBy) ?? payers[0]
    const today = new Date()
    const dateLabel = `${`${today.getMonth() + 1}`.padStart(2, "0")}.${`${today.getDate()}`.padStart(2, "0")}`

    setExpenses((current) => [
      {
        id: `e-${Date.now()}`,
        title: title.trim(),
        category,
        amount: parsed,
        paidBy: payer.name,
        paidByInitials: payer.initials,
        splitWith: payers.map((item) => item.name),
        date: dateLabel,
      },
      ...current,
    ])
    resetForm()
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">정산</h2>
          <p className="text-sm text-muted-foreground">
            여행 지출을 기록하고 누구→누구에게 송금할지 확인할 수 있어요.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) resetForm()
          }}
        >
          <DialogTrigger render={<Button className="rounded-full font-semibold" />}>
            <Plus data-icon="inline-start" />
            지출 추가
          </DialogTrigger>
          <DialogContent className="gap-5 rounded-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle>지출 추가</DialogTitle>
              <DialogDescription>공동 지출을 입력하면 1인당 금액이 다시 계산돼요.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="expense-title">항목</FieldLabel>
                  <Input
                    id="expense-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="예: 택시비"
                    className="rounded-xl"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="expense-amount">금액 (원)</FieldLabel>
                  <Input
                    id="expense-amount"
                    inputMode="numeric"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="50000"
                    className="rounded-xl"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>카테고리</FieldLabel>
                  <Select
                    items={["식사", "숙소", "교통", "관광", "기타"].map((item) => ({
                      value: item,
                      label: item,
                    }))}
                    value={category}
                    onValueChange={(value) => setCategory(value as string)}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["식사", "숙소", "교통", "관광", "기타"].map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>결제자</FieldLabel>
                  <Select
                    items={payers.map((payer) => ({ value: payer.name, label: payer.name }))}
                    value={paidBy}
                    onValueChange={(value) => setPaidBy(value as string)}
                  >
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {payers.map((payer) => (
                        <SelectItem key={payer.name} value={payer.name}>
                          {payer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="submit" className="rounded-full font-semibold">
                  추가하기
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Receipt className="size-3.5" />
            총 지출
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums">
            {formatWon(total)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{expenses.length}건 · 오사카 · 교토 여행</p>
        </div>
        <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <div className="flex items-center gap-2 text-xs opacity-80">
            <Users className="size-3.5" />
            1인당 금액
          </div>
          <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums">
            {formatWon(perPerson)}
          </p>
          <p className="mt-1 text-xs opacity-80">총 {memberCount}명 기준 · 균등 분할</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">송금 현황</h3>
        <ul className="flex flex-col gap-2">
          {transfers.map((transfer) => (
            <li
              key={transfer.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-secondary text-xs font-bold">
                    {transfer.fromInitials}
                  </AvatarFallback>
                </Avatar>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                    {transfer.toInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {transfer.from}
                    <span className="mx-1 font-normal text-muted-foreground">→</span>
                    {transfer.to}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatWon(transfer.amount)}
                  </span>
                </div>
              </div>
              <Badge
                variant={transfer.status === "done" ? "default" : "outline"}
                className="shrink-0 font-semibold"
              >
                {transfer.status === "done" ? "완료" : "대기"}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">지출 내역</h3>
          <span className="text-xs tabular-nums text-muted-foreground">{expenses.length}건</span>
        </div>
        <ul className="flex flex-col gap-2">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Avatar className="size-10">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-bold",
                      expense.paidBy === "지훈"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    )}
                  >
                    {expense.paidByInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{expense.title}</span>
                    <Badge variant="outline" className="font-medium">
                      {expense.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {expense.paidBy} 결제 · {expense.splitWith.length}명 분할 · {expense.date}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {formatWon(expense.amount)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
