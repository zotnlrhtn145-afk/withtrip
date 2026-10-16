import type { SupabaseClient } from '@supabase/supabase-js';
import type { CashEntry } from './cash-wallet';
import type { CashExchange } from './cash-exchange';
export async function readCashExchanges(client: SupabaseClient, tripId: string) {
  const exchanges: CashExchange[] = [];
  for (let offset = 0; ; offset += 500) {
    const {data,error} = await client.from('trip_wallet_exchanges').select('id,from_currency,from_amount,to_currency,to_amount,created_at').eq('trip_id',tripId).order('id').range(offset,offset+499);
    if (error) {
      if (offset === 0 && (error.code === '42P01' || error.code === 'PGRST205')) return {exchanges, exchangeAvailable:false};
      throw error;
    }
    exchanges.push(...(data ?? []) as CashExchange[]);
    if (!data || data.length < 500) return {exchanges, exchangeAvailable:true};
  }
}
export async function readCashWallet(client: SupabaseClient, tripId: string) {
  const readEntries = async () => {
    const entries: CashEntry[] = [];
    for (let offset = 0; ; offset += 500) {
      const {data,error} = await client.from('trip_wallet_entries').select('id,person_id,currency,kind,amount,fx_rate,payout_currency,payout_amount,created_at').eq('trip_id',tripId).order('id').range(offset,offset+499);
      if (error) throw error;
      entries.push(...(data ?? []) as CashEntry[]);
      if (!data || data.length < 500) return entries;
    }
  };
  const [entries, exchange] = await Promise.all([readEntries(), readCashExchanges(client,tripId)]);
  return {entries,...exchange};
}
