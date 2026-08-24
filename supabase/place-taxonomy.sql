-- 장소 분류 개편 — 대분류 6개 · 소분류(열린 태그) · 출처와 확신
--
-- ## 왜 필요한가 (신고: "카테고리가 제대로 안 나눠져")
--
-- 저장된 502건 중 429건(85%)이 「레스토랑」이었고 관광지는 11건(2%)이었다.
-- 옷가게(Aimé Leon Dore)·칼 쇼룸·쇼핑거리가 전부 레스토랑에 들어와 있었다.
-- 담을 칸이 없어서다 — 대분류가 넷뿐이었다.
--
-- ## ⚠️ 왜 「출처」와 「확신」을 같이 저장하나
--
-- 이게 없어서 사고가 났다. 다시 분류를 돌려 보니 AI 가 정성껏 붙인
-- 「한식」·「고기·구이」가 전부 규칙이 찍은 「기타」로 **내려앉았다.**
-- 어느 값이 더 믿을 만한지 알 방법이 없었기 때문이다.
--
-- 이제 값마다 어디서 왔는지 남긴다. **더 확실한 것만 덮어쓴다.**
--
--     user   사용자가 고침 — 아무도 못 덮는다
--     google 구글 types    — ai·rule 을 덮는다
--     ai     AI 판정       — rule 을 덮는다
--     rule   이름 규칙     — 빈 값만 채운다
--
-- ## ⚠️ 「기타」와 「미분류」를 나눈다
--
-- 지금 37%가 「기타」인데, 그 안에 *확인했는데 해당 없음* 과 *아직 모름* 이
-- 섞여 있다. 나누면 **모르는 것만** 다시 돌리면 되므로 재작업이 확 준다.
-- 소분류가 비어 있으면 「아직 모름」이다.

-- ---------------------------------------------------------------------------
-- saved_places / places 에 칸을 늘린다
-- ---------------------------------------------------------------------------
alter table public.saved_places
  add column if not exists detail_category text,
  add column if not exists category_source text,
  add column if not exists category_confidence real;

alter table public.places
  add column if not exists detail_category text,
  add column if not exists category_source text,
  add column if not exists category_confidence real;

comment on column public.saved_places.detail_category is
  '소분류(열린 태그). 예: 족발, 야키토리, 우육면. 고정 목록이 아니다.';
comment on column public.saved_places.category_source is
  'user | google | ai | rule — 더 확실한 것만 덮어쓴다.';

-- ---------------------------------------------------------------------------
-- 소분류 태그 — 열린 목록이되, 마구 늘지 않게 한다
-- ---------------------------------------------------------------------------
--
-- ⚠️ 그냥 열어 두면 「족발」·「족발집」·「족발전문점」·「원조족발」이 다 따로 생긴다.
--    다섯 겹으로 막는다:
--      ① AI 에게 **기존 목록을 같이 준다** (가장 효과가 크다)
--      ② 저장 전에 **표기를 정리**한다 (집/전문점/맛집 꼬리 제거)
--      ③ 그래도 비슷하면 **별칭**으로 묶는다 (`canonical_id`)
--      ④ 새 태그는 **후보**로 들어가고, 3번 이상 쓰여야 정식이 된다
--      ⑤ 필터는 **중분류 안에서만** 소분류를 보여준다 (300개가 돼도 화면은 10개)
--    ①②는 코드에, ③④는 이 표에, ⑤는 화면에 있다.

create table if not exists public.place_tags (
  id uuid primary key default gen_random_uuid(),
  /** 정리된 이름. 예: 족발 */
  name text not null unique,
  /** 어느 중분류에 매달리나. 필터가 이걸로 좁힌다 */
  sub_category text,
  /**
   * 같은 뜻의 대표 태그. 자기 자신이면 대표다.
   * ⚠️ 병합은 **되돌릴 수 있어야 한다** — 나중에 「돈코츠라멘」을 떼고 싶어질 수 있다.
   *    그래서 행을 지우지 않고 대표를 가리키게만 한다.
   */
  canonical_id uuid references public.place_tags (id) on delete set null,
  /** 몇 번 쓰였나 — 3번 이상이면 정식 */
  uses integer not null default 0,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists place_tags_sub_idx on public.place_tags (sub_category);

alter table public.place_tags enable row level security;

drop policy if exists "place_tags_read" on public.place_tags;
create policy "place_tags_read" on public.place_tags for select to authenticated using (true);
-- 쓰기는 서버(service_role)만. 앱에서 태그를 만들 일이 없다.

/**
 * 태그를 쓴다. 없으면 만들고, 있으면 횟수를 올린다.
 * 3번 이상 쓰이면 정식으로 승격한다.
 */
create or replace function public.use_place_tag(p_name text, p_sub text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_name is null or btrim(p_name) = '' then return null; end if;

  insert into public.place_tags (name, sub_category, uses)
  values (btrim(p_name), nullif(btrim(coalesce(p_sub, '')), ''), 1)
  on conflict (name) do update
     set uses = public.place_tags.uses + 1,
         sub_category = coalesce(public.place_tags.sub_category, excluded.sub_category)
  returning id into v_id;

  update public.place_tags set approved = true where id = v_id and uses >= 3;
  -- 대표가 있으면 대표를 돌려준다 — 부르는 쪽은 별칭인지 몰라도 된다
  return coalesce((select canonical_id from public.place_tags where id = v_id), v_id);
end $$;

revoke all on function public.use_place_tag(text, text) from public, anon, authenticated;
