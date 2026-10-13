import { splitExpense, type SharePart } from "./expense-share";

export type CashEntry = {
  id: string;
  person_id: string;
  currency: string;
  kind: "deposit" | "refund";
  amount: number;
  fx_rate: number;
  payout_currency?: string | null;
  payout_amount?: number | null;
  created_at: string;
};
export type CashExpense = {
  id: string;
  currency: string;
  amount: number;
  parts: SharePart[];
};
export type CashWallet = {
  currency: string;
  collected: number;
  spent: number;
  refunded: number;
  remaining: number;
  rate: number;
  people: {
    id: string;
    deposited: number;
    owed: number;
    refunded: number;
    balance: number;
  }[];
};
export function cashDigits(currency: string) {
  return (
    new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}
export function cashAmount(input: string, currency: string): number | null {
  const raw = input.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw),
    scale = 10 ** cashDigits(currency);
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 2_000_000_000 ||
    Math.abs(value * scale - Math.round(value * scale)) > 0.00001
  )
    return null;
  return value;
}
export function cashLabel(amount: number, currency: string) {
  return `${amount.toLocaleString("ko-KR", { maximumFractionDigits: cashDigits(currency) })} ${currency}`;
}
/** 공동 현금은 같은 통화끼리 계산합니다. 입금/환급은 지출이 아니며 카드 수수료도 없습니다. */
export function cashWallets(
  entries: CashEntry[],
  expenses: CashExpense[],
  memberIds: string[],
): CashWallet[] {
  const currencies = [
    ...new Set([
      ...entries.map((e) => e.currency),
      ...expenses.map((e) => e.currency),
    ]),
  ];
  return currencies.map((currency) => {
    const scale = 10 ** cashDigits(currency);
    const people = new Map<
      string,
      { id: string; deposited: number; owed: number; refunded: number }
    >();
    const person = (id: string) => {
      let p = people.get(id);
      if (!p) {
        p = { id, deposited: 0, owed: 0, refunded: 0 };
        people.set(id, p);
      }
      return p;
    };
    memberIds.forEach(person);
    let collected = 0,
      spent = 0,
      refunded = 0;
    const rows = entries
      .filter((e) => e.currency === currency)
      .sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      );
    for (const e of rows) {
      if (!Number.isFinite(Number(e.amount)) || Number(e.amount) <= 0)
        throw new Error("공동 지갑 금액을 확인해 주세요.");
      const units = Math.round(Number(e.amount) * scale);
      if (e.kind === "deposit") {
        collected += units;
        person(e.person_id).deposited += units;
      } else {
        refunded += units;
        person(e.person_id).refunded += units;
      }
    }
    for (const e of expenses.filter((e) => e.currency === currency)) {
      const units = Math.round(Number(e.amount) * scale);
      if (!Number.isSafeInteger(units) || units <= 0)
        throw new Error("공동 지출 금액을 확인해 주세요.");
      const parts = (
        e.parts.length ? e.parts : memberIds.map((id) => ({ id, amount: null }))
      )
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id));
      if (!parts.length) throw new Error("공동 지출 분담자를 확인해 주세요.");
      const result = splitExpense(
        units,
        parts.map((p) => ({
          id: p.id,
          amount: p.amount == null ? null : Math.round(p.amount * scale),
        })),
      );
      if (result.problem) throw new Error("공동 지출 분담액을 확인해 주세요.");
      spent += units;
      for (const [id, value] of result.byPerson) person(id).owed += value;
    }
    const rate =
      currency === "KRW"
        ? 1
        : Number(rows.find((e) => e.kind === "deposit")?.fx_rate ?? 0);
    return {
      currency,
      collected: collected / scale,
      spent: spent / scale,
      refunded: refunded / scale,
      remaining: (collected - spent - refunded) / scale,
      rate,
      people: [...people.values()].map((p) => ({
        id: p.id,
        deposited: p.deposited / scale,
        owed: p.owed / scale,
        refunded: p.refunded / scale,
        balance: (p.deposited - p.owed - p.refunded) / scale,
      })),
    };
  });
}
