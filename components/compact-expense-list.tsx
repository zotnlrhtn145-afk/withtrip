"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatExpenseDateLabel, initialsFromNickname, type ExpenseRecord, type SettlementMember } from "@/lib/settlements-api"
import { settlementMoney } from "@/shared/settlement-currency"
import { DEFAULT_FEE_RATE } from "@/shared/fx"
import { cn } from "@/lib/utils"

/** Figma461:4921: 68px 두 줄 목록. 사진은 실제 분담자입니다. */
export function CompactExpenseList({ expenses, members, onSelect }: { expenses: ExpenseRecord[]; members: SettlementMember[]; onSelect: (expense: ExpenseRecord) => void }) {
  return (
                      <ul className="flex flex-col">
                        {expenses.map(expense => {
                          const ids = expense.participantIds.length ? expense.participantIds : members.map(member => member.userId)
                          const money = settlementMoney({ amount: expense.amount, currency: expense.currency ?? "KRW", fxRate: expense.fxRate ?? ((expense.currency ?? "KRW") === "KRW" ? 1 : 0) }, expense.feeRate ?? DEFAULT_FEE_RATE, !!expense.calibrated)
                          return <li key={expense.id} className="border-b border-slate-200">
                            <button type="button" onClick={() => onSelect(expense)} aria-label={`${expense.title}, 상세 보기`} className="flex min-h-[68px] w-full flex-col justify-center gap-1 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-amber-400">
                              <span className="flex w-full items-center gap-3"><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{expense.title || "지출"}</span><span className="max-w-[62%] shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">{money.primary}</span></span>
                              <span className="flex w-full items-center gap-2"><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{formatExpenseDateLabel(expense.expenseDate)} · {expense.payerNickname} 결제</span>
                                <span className="flex shrink-0 items-center" aria-label={`분담자 ${ids.map(id => members.find(member => member.userId === id)?.nickname ?? "멤버").join(", ")}`}>
                                  {ids.slice(0, 4).map((id, index) => { const member = members.find(member => member.userId === id); return <Avatar key={id} className={cn("size-5 border border-white", index > 0 && "-ml-1")}><AvatarImage src={member?.avatarUrl} alt={member?.nickname ?? "멤버"} /><AvatarFallback className="text-[8px]">{initialsFromNickname(member?.nickname ?? "멤버")}</AvatarFallback></Avatar> })}
                                  <span className="ml-1 text-[10px] text-slate-500">{ids.length}명</span>
                                </span>
                              </span>
                            </button>
                          </li>
                        })}
                      </ul>
  )
}
