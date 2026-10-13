"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { cashLabel, cashWallets, type CashEntry } from "@/shared/cash-wallet";
import type { ExpenseRecord, SettlementMember } from "@/lib/settlements-api";
export function CashWalletView({
  tripId,
  expenses,
  members,
  onPendingChange,
}: {
  tripId: string;
  expenses: ExpenseRecord[];
  members: SettlementMember[];
  onPendingChange: (pending: boolean) => void;
}) {
  const [entries, setEntries] = useState<CashEntry[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    void createClient()
      .from("trip_wallet_entries")
      .select(
        "id,person_id,currency,kind,amount,fx_rate,payout_currency,payout_amount,created_at",
      )
      .eq("trip_id", tripId)
      .order("created_at")
      .then(({ data, error }) => {
        if (!alive) return;
        setLoading(false);
        if (error) {
          setError("공동 지갑을 불러오지 못했어요.");
          return;
        }
        setEntries((data ?? []) as CashEntry[]);
      });
    return () => {
      alive = false;
    };
  }, [tripId, expenses]);
  const result = useMemo(() => {
    try {
      return {
        wallets: cashWallets(
          entries,
          expenses
            .filter((e) => e.fromPool)
            .map((e) => ({
              id: e.id,
              amount: e.amount,
              currency: e.currency ?? "KRW",
              parts: e.participantShares?.length
                ? e.participantShares
                : (e.participantIds.length
                    ? e.participantIds
                    : members.map((m) => m.userId)
                  ).map((id) => ({ id, amount: null })),
            })),
          members.map((m) => m.userId),
        ),
        error: "",
      };
    } catch (e) {
      return {
        wallets: [],
        error: e instanceof Error ? e.message : "분담액 확인 필요",
      };
    }
  }, [entries, expenses, members]);
  useEffect(() => {
    onPendingChange(
      loading ||
        !!error ||
        !!result.error ||
        result.wallets.some(
          (w) =>
            Math.abs(w.remaining) > 0.00001 ||
            w.people.some((p) => Math.abs(p.balance) > 0.00001),
        ),
    );
  }, [loading, error, result, onPendingChange]);
  return (
    <section className="my-4 rounded-2xl border border-neutral-200 p-4">
      <h3 className="text-sm font-semibold">공동 현금 지갑</h3>
      {error || result.error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error || result.error}
        </p>
      ) : loading ? (
        <p className="mt-2 text-sm text-neutral-500">불러오는 중…</p>
      ) : result.wallets.length ? (
        result.wallets.map((w) => (
          <details key={w.currency} className="mt-3">
            <summary className="cursor-pointer list-none">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["모은 돈", w.collected],
                  ["사용한 돈", w.spent],
                  ["남은 돈", w.remaining],
                ].map(([title, n]) => (
                  <div key={String(title)}>
                    <p className="text-xs text-neutral-500">{title}</p>
                    <p className="mt-1 break-words text-xs font-semibold">
                      {cashLabel(Number(n), w.currency)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-xs text-neutral-500">
                입금 · 환급 내역 보기
              </p>
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              {w.people.map((p) => (
                <div key={p.id} className="flex justify-between gap-4">
                  <span>
                    {members.find((m) => m.userId === p.id)?.nickname ??
                      "참여자"}
                  </span>
                  <span>
                    {cashLabel(Math.abs(p.balance), w.currency)}{" "}
                    {p.balance > 0
                      ? "받기"
                      : p.balance < 0
                        ? "더 넣기"
                        : "완료"}
                  </span>
                </div>
              ))}
              <p className="text-xs text-neutral-500">
                돌려준 돈 {cashLabel(w.refunded, w.currency)} · 개인 결제는 별도
                정산
              </p>
              {entries
                .filter((e) => e.currency === w.currency)
                .map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between gap-3 border-t pt-2 text-xs"
                  >
                    <span>
                      {members.find((m) => m.userId === e.person_id)
                        ?.nickname ?? "참여자"}{" "}
                      · {e.kind === "deposit" ? "입금" : "환급"}
                    </span>
                    <span>
                      {cashLabel(Number(e.amount), w.currency)}
                      {e.payout_currency
                        ? ` / 실제 ${Number(e.payout_amount).toLocaleString()}원 반환`
                        : ""}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        ))
      ) : (
        <p className="mt-2 text-sm text-neutral-500">
          함께 모으고, 쓰고, 남은 돈을 돌려받아요
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        입금·지출·환급 기록은 앱에서 할 수 있어요.
      </p>
    </section>
  );
}
