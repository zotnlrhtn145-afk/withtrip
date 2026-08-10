-- WITHTRIP: 친구에게 저장 장소 추천 (place_recommendations)
-- 보낸 사람이 자기 저장 장소를 친구에게 "추천"으로 보낸다. 받는 사람은 "친구 추천" 탭에서 보고
-- "내 저장에 담기"를 누르면 saved_places(trip_id NULL, 본인 소유)로 복사된다.
-- Supabase Dashboard → SQL Editor 또는 scripts/supabase-deploy.sh 로 실행 (idempotent).

create table if not exists public.place_recommendations (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  source_place_id uuid references public.saved_places (id) on delete set null, -- 보낸이의 원본 장소(있으면)
  -- 장소 스냅샷 (원본이 바뀌거나 삭제돼도 추천은 유지)
  place_name text not null default '',
  category text,
  sub_category text,
  local_name text,
  address text,
  phone_number text,
  memo text,
  image_url text,
  rating double precision,
  review_count integer,
  price_range text,
  lat double precision,
  lng double precision,
  status text not null default 'pending' check (status in ('pending', 'saved', 'dismissed')),
  saved_place_id uuid references public.saved_places (id) on delete set null, -- 담은 뒤 생긴 내 저장 장소
  created_at timestamptz not null default now(),
  constraint place_rec_no_self check (sender_id <> recipient_id)
);

comment on table public.place_recommendations is '친구에게 보낸 저장 장소 추천 (받는이가 담으면 saved_places로 복사)';

create index if not exists place_rec_recipient_idx on public.place_recommendations (recipient_id, status);
create index if not exists place_rec_sender_idx on public.place_recommendations (sender_id);
create index if not exists place_rec_created_idx on public.place_recommendations (created_at desc);

alter table public.place_recommendations enable row level security;

drop policy if exists "place_rec_select_own" on public.place_recommendations;
drop policy if exists "place_rec_insert_sender" on public.place_recommendations;
drop policy if exists "place_rec_update_recipient" on public.place_recommendations;
drop policy if exists "place_rec_delete_own" on public.place_recommendations;

-- 보낸 사람 / 받는 사람 둘 다 자기 관련 추천을 조회
create policy "place_rec_select_own"
  on public.place_recommendations for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- 본인이 보낸 것만 생성
create policy "place_rec_insert_sender"
  on public.place_recommendations for insert to authenticated
  with check (sender_id = auth.uid());

-- 받는 사람이 상태 변경(담기/무시)
create policy "place_rec_update_recipient"
  on public.place_recommendations for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- 받는 사람(무시) 또는 보낸 사람(취소)이 삭제
create policy "place_rec_delete_own"
  on public.place_recommendations for delete to authenticated
  using (recipient_id = auth.uid() or sender_id = auth.uid());
