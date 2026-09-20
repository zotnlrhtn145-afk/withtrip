alter table public.places add column if not exists cover_policy_version text;
comment on column public.places.cover_policy_version is 'Representative photo selection policy revision; null means legacy.';
