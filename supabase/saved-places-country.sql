-- 저장한 곳의 나라·지역 자동 채우기.
--
-- ⚠️ **아무 데서도 채우지 않고 있었다.** 예전에 한 번 지오코딩으로 메꿔 넣은 게 전부라
--    그 뒤에 담은 곳은 나라가 비어 저장 화면의 나라/도시 필터에 안 나타났다.
--
-- ⚠️ **트리거로 한다.** 화면 코드에 넣으면 이미 나간 앱 빌드는 영영 못 받는다.
--    담는 길도 여러 개다(인스타 공유·장소 추가·일정 등록·추천 수락).
--
-- ⚠️ **구글에 다시 묻지 않는다.** 주소에 나라 이름이 이미 들어 있다. 공짜로 읽는다.
--
-- ⚠️ **규칙은 이 함수 한 곳에만 둔다.** 트리거와 메꾸기에 같은 CASE 를 두 번 적었더니
--    한쪽에만 'Singapore' 를 넣어서 싱가포르 주소가 안 잡혔다. 두 번 적지 않는다.

create or replace function public.country_of_address(a text)
returns text
language sql
immutable
as $$
  select case
    when a is null then null
    -- 나라 이름이 그대로 적힌 경우 (앞이든 뒤든)
    when a like '%대한민국%' or a like '%South Korea%' then 'KR'
    when a like '%일본%' or a like '%Japan%' then 'JP'
    when a like '%베트남%' or a like '%Vietnam%' then 'VN'
    when a like '%태국%' or a like '%Thailand%' then 'TH'
    when a like '%싱가포르%' or a like '%Singapore%' then 'SG'
    when a like '%홍콩%' or a like '%Hong Kong%' then 'HK'
    when a like '%대만%' or a like '%Taiwan%' then 'TW'
    when a like '%중국%' or a like '%China%' then 'CN'
    when a like '%필리핀%' or a like '%Philippines%' then 'PH'
    when a like '%미국%' or a like '%United States%' then 'US'
    when a like '%프랑스%' or a like '%France%' then 'FR'
    when a like '%독일%' or a like '%Germany%' then 'DE'
    when a like '%벨기에%' or a like '%Belgium%' then 'BE'
    when a like '%스페인%' or a like '%Spain%' then 'ES'
    when a like '%이탈리아%' or a like '%Italy%' then 'IT'
    when a like '%영국%' or a like '%United Kingdom%' then 'GB'
    when a like '%오스트레일리아%' or a like '%호주%' or a like '%Australia%' then 'AU'
    -- 나라 이름이 빠진 짧은 주소 — 지명으로 가린다
    --   "서울 강남구 …", "제주 제주시 …" 처럼 국내 주소는 나라를 생략하는 일이 흔하다
    when a ~ '(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)' then 'KR'
    --   일본 주소는 한자 행정구역이 확실한 표시다
    when a ~ '(県|都道府県|東京都|大阪府|京都府)' then 'JP'
    else null
  end
$$;

create or replace function public.country_name_of(cc text)
returns text
language sql
immutable
as $$
  select case cc
    when 'KR' then '대한민국' when 'JP' then '일본'   when 'VN' then '베트남'
    when 'TH' then '태국'     when 'SG' then '싱가포르' when 'HK' then '홍콩'
    when 'TW' then '대만'     when 'CN' then '중국'   when 'PH' then '필리핀'
    when 'US' then '미국'     when 'FR' then '프랑스' when 'DE' then '독일'
    when 'BE' then '벨기에'   when 'ES' then '스페인' when 'IT' then '이탈리아'
    when 'GB' then '영국'     when 'AU' then '오스트레일리아'
    else null end
$$;

-- 한국의 시/도. 화면이 regionLabel() 로 "부산광역시 → 부산" 처럼 줄여 보여준다.
-- 긴 표기가 없으면 짧은 표기(서울/제주…)라도 잡는다.
create or replace function public.kr_region_of(a text)
returns text
language sql
immutable
as $$
  select coalesce(
    substring(a from '([가-힣]+(?:특별자치도|특별자치시|광역시|특별시|도))'),
    substring(a from '(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)')
  )
$$;

create or replace function public.saved_places_fill_country()
returns trigger
language plpgsql
as $$
begin
  -- 이미 채워져 있으면 건드리지 않는다(지오코딩으로 넣은 정확한 값이 우선)
  if new.country_code is null then
    new.country_code := public.country_of_address(new.address);
    new.country := public.country_name_of(new.country_code);
  end if;
  if new.country_code = 'KR' and new.region is null then
    new.region := public.kr_region_of(coalesce(new.address, ''));
  end if;
  return new;
end
$$;

drop trigger if exists saved_places_fill_country_trg on public.saved_places;
create trigger saved_places_fill_country_trg
  before insert on public.saved_places
  for each row
  execute function public.saved_places_fill_country();

-- 이미 쌓인 것 메꾸기 (구글 호출 0회, 위와 **같은 함수**를 쓴다)
update public.saved_places
   set country_code = public.country_of_address(address),
       country      = public.country_name_of(public.country_of_address(address))
 where country_code is null and public.country_of_address(address) is not null;

update public.saved_places
   set region = public.kr_region_of(coalesce(address, ''))
 where country_code = 'KR' and region is null;
