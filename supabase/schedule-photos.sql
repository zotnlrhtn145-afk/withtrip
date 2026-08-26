-- 일정마다 사진을 남긴다 — "추억을 남길 수 있게"
--
-- ## ⚠️ 비용을 먼저 정하고 만든다
--
-- 사진은 이 앱에서 **가장 비싸질 수 있는 기능**이다. 요금은 저장 용량보다
-- **전송량(egress)** 에서 터진다. 목록을 한 번 내릴 때마다 원본을 받으면
-- 사람 수 × 일정 수 × 스크롤 횟수만큼 곱해진다.
--
-- 그래서 규칙을 둘로 못박는다.
--
--   · 목록에는 **썸네일만** (400px · 품질 0.7 ≈ 25KB)
--   · 원본(1920px · 0.8 ≈ 300KB)은 **눌러서 크게 볼 때만**
--
-- 이 크기는 대화방 사진이 이미 쓰던 값이다(`src/lib/chat-image.ts`).
-- **같은 파이프라인을 그대로 쓴다** — 새로 만들면 두 곳이 서로 어긋난다.
-- 저장소도 `chat-images` 버킷을 같이 쓴다. 버킷을 새로 파면 공개 설정·정책·
-- R2 이전을 두 번 해야 한다.
--
-- ## ⚠️ 사진 자체는 여기 없다
--
-- 이 표에는 **경로만** 담는다. 파일은 저장소에 있다. 그래서 나중에
-- Cloudflare R2(전송량 무료)로 옮길 때 `chatImageUrl()` 하나만 고치면 된다.

create table if not exists public.schedule_photos (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.trip_schedules (id) on delete cascade,
  /**
   * ⚠️ 일정에서 타고 올라가면 알 수 있는 값이지만 **일부러 같이 둔다.**
   *    정책이 매번 trip_schedules 를 거쳐 trips 까지 두 번 타고 올라가면
   *    사진 한 장마다 조인이 두 번 붙는다. 목록에서 수십 장을 그리므로
   *    여기서 바로 판단할 수 있게 한다.
   */
  trip_id uuid not null references public.trips (id) on delete cascade,
  /** 원본 경로 — 크게 볼 때만 받는다 */
  path text not null,
  /** 썸네일 경로 — 목록에 그리는 것 */
  thumb text,
  width integer,
  height integer,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_photos_schedule_idx
  on public.schedule_photos (schedule_id, created_at);

alter table public.schedule_photos enable row level security;

-- 보기 — 그 여행에 속한 사람이면 누구나 (trip_schedules 와 같은 규칙)
drop policy if exists "schedule_photos_select_member" on public.schedule_photos;
create policy "schedule_photos_select_member"
  on public.schedule_photos for select to authenticated
  using (
    exists (
      select 1 from public.trips t
       where t.id = schedule_photos.trip_id
         and (t.user_id = auth.uid()
              or exists (select 1 from public.trip_members tm
                          where tm.trip_id = t.id and tm.user_id = auth.uid()))
    )
  );

-- 올리기 — 여행에 속한 사람이면 누구나. 남의 이름으로는 못 올린다.
drop policy if exists "schedule_photos_insert_member" on public.schedule_photos;
create policy "schedule_photos_insert_member"
  on public.schedule_photos for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.trips t
       where t.id = schedule_photos.trip_id
         and (t.user_id = auth.uid()
              or exists (select 1 from public.trip_members tm
                          where tm.trip_id = t.id and tm.user_id = auth.uid()))
    )
  );

/*
  지우기 — **올린 사람과 여행 주인**만.

  ⚠️ 아무나 지우게 하면 안 된다. 여럿이 쓰는 여행에서 남의 추억이 말없이
     사라지는 건 되돌릴 수 없다. 반대로 올린 사람만 지우게 하면, 나간 사람이
     남긴 사진을 아무도 못 치운다 — 그래서 주인에게도 권한을 준다.
*/
drop policy if exists "schedule_photos_delete_own" on public.schedule_photos;
create policy "schedule_photos_delete_own"
  on public.schedule_photos for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.trips t
                where t.id = schedule_photos.trip_id and t.user_id = auth.uid())
  );
