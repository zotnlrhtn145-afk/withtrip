"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { settlementExpenseInput, initialsFromNickname, type ExpenseRecord, type SettlementMember } from "@/lib/settlements-api"
import { settlementMoney, settlementSummary } from "@/shared/settlement-currency"
import { splitExpense } from "@/shared/expense-share"
import { DEFAULT_FEE_RATE } from "@/shared/fx"
import styles from "./expense-detail-sheet.module.css"

/** Figma461:5088. 원화가 먼저, 저장된 현지 정보와 사람별 분담은 상세에서 확인합니다. */
export function ExpenseDetailSheet({ expense: selection, members, onClose, onEdit, onDelete, onReceipt }: {
  expense: ExpenseRecord | null
  members: SettlementMember[]
  onClose: () => void
  onEdit: (expense: ExpenseRecord) => void
  onDelete: (expense: ExpenseRecord) => void
  onReceipt: (url: string) => void
}) {
  const [previous, setPrevious] = useState(selection)
  useEffect(() => { if (selection) setPrevious(selection) }, [selection])
  const expense = selection ?? previous
  const money = expense ? { amount: expense.amount, currency: expense.currency ?? "KRW", fxRate: expense.fxRate ?? ((expense.currency ?? "KRW") === "KRW" ? 1 : 0) } : null
  const display = expense && money ? settlementMoney(money, expense.feeRate ?? DEFAULT_FEE_RATE, !!expense.calibrated) : null
  let shares = new Map<string, number>()
  if (expense && display?.amountKrw != null) {
    const input = settlementExpenseInput(expense, members.map(member => member.userId))
    shares = splitExpense(input.amount, input.parts).byPerson
  }
  const details = expense && money ? settlementSummary([{ ...money, feeRate: expense.feeRate ?? DEFAULT_FEE_RATE, calibrated: !!expense.calibrated }]).foreignDetails : []
  return <Dialog open={!!selection} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent showCloseButton={false} className={styles.sheet}>
      <div className="mx-auto h-1 w-8 shrink-0 rounded bg-slate-200" />
      <div className="flex shrink-0 items-center justify-between"><DialogTitle className="text-[15px] font-bold">지출 상세</DialogTitle><button type="button" onClick={onClose} className="min-h-11 min-w-11 text-right text-xs text-slate-500">닫기</button></div>
      {expense && display ? <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain">
        <div><h3 className="break-words text-[19px] font-bold">{expense.title || "지출"}</h3><DialogDescription className="mt-1 text-xs text-slate-500">{expense.category} · {expense.expenseDate} · {expense.payerNickname} 결제</DialogDescription></div>
        <p className="break-words text-[28px] font-bold tabular-nums text-slate-900">{display.primary}</p>
        {details.map(info => <dl key={info.currency} className="space-y-2 rounded-xl bg-slate-50 p-3">{[{ label: "현지 금액", value: info.amount }, { label: "적용 환율", value: info.rate }, { label: "카드 수수료", value: info.fee }].map(row => <div key={row.label} className="flex items-start justify-between gap-3"><dt className="shrink-0 text-[11px] text-slate-500">{row.label}</dt><dd className="text-right text-xs tabular-nums">{row.value}</dd></div>)}</dl>)}
        <div><p className="text-sm font-bold">분담 {shares.size}명</p>{display.amountKrw == null ? <p className="py-3 text-xs text-slate-500">환율 확인 후 부담액을 계산할 수 있어요.</p> : [...shares].map(([id, amount]) => { const member = members.find(row => row.userId === id); return <div key={id} className="flex min-h-11 items-center gap-2"><Avatar className="size-7"><AvatarImage src={member?.avatarUrl} alt="" /><AvatarFallback className="text-xs">{initialsFromNickname(member?.nickname ?? "멤버")}</AvatarFallback></Avatar><span className="min-w-0 flex-1 break-words text-[13px]">{member?.nickname ?? "멤버"}</span><span className="shrink-0 text-[13px] tabular-nums">{amount.toLocaleString()}원</span></div>})}</div>
        {shares.size ? <div className="flex justify-between border-t border-slate-200 pt-3 text-xs"><span>분담 합계</span><span className="tabular-nums">{[...shares.values()].reduce((sum, value) => sum + value, 0).toLocaleString()}원</span></div> : null}
        {expense.receiptUrl ? <button type="button" className="min-h-11 text-sm" onClick={() => onReceipt(expense.receiptUrl!)}>영수증 보기</button> : null}
        <div className="flex justify-between"><button type="button" className="min-h-11 text-[13px]" onClick={() => onEdit(expense)}>지출 수정</button><button type="button" className="min-h-11 text-xs text-slate-500" onClick={() => onDelete(expense)}>삭제</button></div>
      </div> : null}
    </DialogContent>
  </Dialog>
}
