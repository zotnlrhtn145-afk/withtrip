import { cashDigits, cashWallets, type CashEntry, type CashExpense } from './cash-wallet';
import { splitExpense } from './expense-share';

export type CashExchange = { id: string; from_currency: string; from_amount: number; to_currency: string; to_amount: number; created_at: string };
/** Actual received cash includes exchange fees. Exchange itself is not spending.
 * Carry the source cash's weighted acquisition cost; never revalue old costs at today's FX. */
export function cashLedger(entries: CashEntry[], expenses: (CashExpense & { created_at?: string })[], memberIds: string[], exchanges: CashExchange[]) {
  const wallets = cashWallets(entries, expenses, memberIds);
  if (!exchanges.length) return { wallets };
  const holdings = new Map<string, { units: number; cost: number }>();
  const shares = new Map<string, Map<string, number>>();
  const balances = (c: string) => {
    if (!shares.has(c)) shares.set(c, new Map(memberIds.map(id => [id, 0])));
    return shares.get(c)!;
  };
  const addShare = (c: string, id: string, n: number) => {
    const b = balances(c); b.set(id, (b.get(id) ?? 0) + n);
  };
  // Signed largest-remainder allocation keeps debts and credits, and every minor unit.
  const allocate = (total: number, weights: Map<string, number>, denominator: number) => {
    const d = BigInt(denominator);
    const rows = [...weights].map(([id, value]) => {
      const numerator = BigInt(total) * BigInt(value);
      let quotient = numerator / d, remainder = numerator % d;
      if (remainder < BigInt(0)) { quotient -= BigInt(1); remainder += d; }
      return { id, amount:Number(quotient), remainder };
    }).sort((a,b) => a.remainder === b.remainder ? a.id.localeCompare(b.id) : a.remainder > b.remainder ? -1 : 1);
    let rest = total - rows.reduce((sum,r) => sum+r.amount,0);
    for (const r of rows) if (rest-- > 0) r.amount++;
    return new Map(rows.map(r => [r.id,r.amount]));
  };
  const holding = (currency: string) => {
    if (!holdings.has(currency)) holdings.set(currency, { units: 0, cost: 0 });
    return holdings.get(currency)!;
  };
  const units = (n: number, c: string) => {
    const u = Math.round(Number(n) * 10 ** cashDigits(c));
    if (!Number.isSafeInteger(u) || u <= 0) throw new Error('공동돈 금액을 확인해 주세요.');
    return u;
  };
  const take = (currency: string, n: number) => {
    const h = holding(currency), u = units(n, currency);
    if (u > h.units) throw new Error('환전 전후 공동돈 기록 순서와 잔액을 확인해 주세요.');
    const cost = h.cost * u / h.units;
    h.units -= u; h.cost -= cost;
    if (!h.units) h.cost = 0;
    return cost;
  };
  const events = [
    ...entries.map(e => ({ id: e.id, at: e.created_at, kind: 'entry' as const, e })),
    ...expenses.map(e => ({ id: e.id, at: e.created_at ?? '', kind: 'expense' as const, e })),
    ...exchanges.map(e => ({ id: e.id, at: e.created_at, kind: 'exchange' as const, e })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (a.at.match(/\.(\d+)/)?.[1] ?? '').padEnd(6,'0').localeCompare((b.at.match(/\.(\d+)/)?.[1] ?? '').padEnd(6,'0')) || a.id.localeCompare(b.id));
  for (const event of events) {
    if (!event.at || !Number.isFinite(Date.parse(event.at))) throw new Error('공동돈 기록 시각을 확인해 주세요.');
    if (event.kind === 'exchange') {
      const e = event.e;
      if (e.from_currency === e.to_currency) throw new Error('서로 다른 환전 통화를 선택해 주세요.');
      const source = holding(e.from_currency), outgoing = units(e.from_amount,e.from_currency), incoming = units(e.to_amount,e.to_currency);
      if (source.units < outgoing) throw new Error('환전할 공동 현금이 부족합니다.');
      const moved = allocate(outgoing, balances(e.from_currency), source.units);
      const received = allocate(incoming, balances(e.from_currency), source.units);
      const cost = take(e.from_currency, e.from_amount), target = holding(e.to_currency);
      target.units += incoming; target.cost += cost;
      for (const [id,n] of moved) addShare(e.from_currency,id,-n);
      for (const [id,n] of received) addShare(e.to_currency,id,n);
    } else if (event.kind === 'entry') {
      const e = event.e;
      if (e.kind === 'deposit') {
        const rate = e.currency === 'KRW' ? 1 : Number(e.fx_rate);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('입금 시 저장된 환율을 확인해 주세요.');
        const h = holding(e.currency), cost = Number(e.amount) * rate;
        h.units += units(e.amount, e.currency); h.cost += cost; addShare(e.currency,e.person_id,units(e.amount,e.currency));
      } else { take(e.currency,e.amount); addShare(e.currency,e.person_id,-units(e.amount,e.currency)); }
    } else {
      const e = event.e, total = units(e.amount, e.currency);
      const parts = (e.parts.length ? e.parts : memberIds.map(id => ({ id, amount: null }))).slice().sort((a,b) => a.id.localeCompare(b.id));
      const split = splitExpense(total, parts.map(p => ({ id:p.id, amount:p.amount == null ? null : Math.round(p.amount * 10 ** cashDigits(e.currency)) })));
      if (split.problem || !parts.length) throw new Error('공동 지출 분담액을 확인해 주세요.');
      take(e.currency, e.amount);
      for (const [id, share] of split.byPerson) addShare(e.currency,id,-share);
    }
  }
  for (const [currency, h] of holdings) {
    let w = wallets.find(w => w.currency === currency);
    if (!w) { w = { currency, collected:0, spent:0, refunded:0, remaining:0, rate:0, people:[] }; wallets.push(w); }
    w.exchangedIn = exchanges.filter(e=>e.to_currency===currency).reduce((sum,e)=>sum+Number(e.to_amount),0);
    w.exchangedOut = exchanges.filter(e=>e.from_currency===currency).reduce((sum,e)=>sum+Number(e.from_amount),0);
    w.remaining = h.units / 10 ** cashDigits(currency);
    w.rate = w.remaining ? h.cost / w.remaining : 0;
    w.people = [...balances(currency)].map(([id, balance]) => ({
      ...(w!.people.find(p => p.id === id) ?? {id,deposited:0,owed:0,refunded:0}),
      balance: balance / 10 ** cashDigits(currency),
    }));
  }
  return { wallets };
}
