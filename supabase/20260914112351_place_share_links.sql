-- Applied by MCP; no existing records changed.
create table public.place_share_links (token text primary key check (token ~ '^[a-f0-9]{48}$'), user_id uuid not null references auth.users(id) on delete cascade, sender text not null, place jsonb not null check (jsonb_typeof(place) = 'object'), created_at timestamptz not null default now(), revoked_at timestamptz);
alter table public.place_share_links enable row level security;
revoke all on public.place_share_links from anon, authenticated;
grant select, insert, update, delete on public.place_share_links to service_role;
create index place_share_links_user_idx on public.place_share_links(user_id);
