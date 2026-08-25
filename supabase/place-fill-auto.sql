-- 빈칸을 **저장하는 순간 큐에 넣는다.**
--
-- ⚠️ 여기서 AI 를 부르면 안 된다. 사용자가 저장 버튼을 누르고 기다리게 되고,
--    매번 돈이 나간다. "이건 아직 모른다" 만 적어 두고 배치가 나중에 채운다.
--
-- ⚠️ 큐를 **가게 이름 기준**으로 둔다. 구글 id 가 없는 곳이 많아서(214곳)
--    id 로만 묶으면 절반을 놓친다.

alter table public.place_fill_queue
  add column if not exists place_name text,
  add column if not exists saved_place_id uuid;

/*
  ⚠️ 기본키를 먼저 떼야 `not null` 을 풀 수 있다. 구글 id 가 없는 곳이 214곳이라
     id 를 필수로 두면 그 절반을 담을 수가 없다.
*/
alter table public.place_fill_queue drop constraint if exists place_fill_queue_pkey;
alter table public.place_fill_queue alter column google_place_id drop not null;
alter table public.place_fill_queue add column if not exists id uuid default gen_random_uuid();
update public.place_fill_queue set id = gen_random_uuid() where id is null;
alter table public.place_fill_queue alter column id set not null;
alter table public.place_fill_queue add primary key (id);

create unique index if not exists place_fill_queue_key
  on public.place_fill_queue (coalesce(google_place_id, ''), coalesce(lower(btrim(place_name)), ''));

/**
 * 찜이 들어오거나 바뀔 때, 중분류가 비었으면 큐에 넣는다.
 *
 * ⚠️ 이미 있는 줄은 **다시 넣지 않는다.** 같은 가게를 열 명이 찜해도 큐에는 하나다.
 * ⚠️ 세 번 실패한 것은 더 넣지 않는다 — 못 푸는 것을 영원히 돌리면 돈만 나간다.
 */
create or replace function public.wt_enqueue_place_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.sub_category is null or btrim(NEW.sub_category) in ('', '기타') then
    insert into public.place_fill_queue (google_place_id, place_name, saved_place_id, need)
    values (NEW.google_place_id, NEW.place_name, NEW.id, 'category')
    on conflict (coalesce(google_place_id, ''), coalesce(lower(btrim(place_name)), '')) do nothing;
  end if;
  return NEW;
end $$;

drop trigger if exists wt_fill_on_save on public.saved_places;
create trigger wt_fill_on_save
  after insert or update of sub_category, place_name on public.saved_places
  for each row execute function public.wt_enqueue_place_fill();

/* 이미 비어 있는 것들도 한 번 담아 둔다 */
insert into public.place_fill_queue (google_place_id, place_name, saved_place_id, need)
select s.google_place_id, s.place_name, s.id, 'category'
  from public.saved_places s
 where (s.sub_category is null or btrim(s.sub_category) in ('', '기타'))
   and btrim(coalesce(s.place_name, '')) <> ''
on conflict (coalesce(google_place_id, ''), coalesce(lower(btrim(place_name)), '')) do nothing;
