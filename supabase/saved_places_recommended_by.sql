-- WITHTRIP: saved_places 에 recommended_by 추가 — 친구 추천으로 담은 장소에 추천인 흔적 표시
-- 친구 추천을 "내 저장에 담기" 할 때, 누가 추천했는지(sender)를 기록해 카드에 프로필로 보여준다.
alter table public.saved_places
  add column if not exists recommended_by uuid references public.profiles (id) on delete set null;

comment on column public.saved_places.recommended_by is '이 장소를 추천해 준 친구(profiles.id). 친구 추천에서 담았을 때만 값이 있음.';

create index if not exists saved_places_recommended_by_idx on public.saved_places (recommended_by);
