-- 공항마다 **시간대**를 알려 준다.
--
-- 왜 필요한가: 교통편의 시각은 **각 공항의 현지 시각**으로 저장한다(항공권에
-- 적힌 그대로). 그래서 벽시계 숫자만 빼면 소요시간이 틀린다.
--
--   ICN 10/15 09:05 → SGN 12:35  → 앱이 적은 소요시간 "3시간 30분"
--   SGN 10/21 13:55 → ICN 21:25  → 앱이 적은 소요시간 "7시간 30분"
--
-- 같은 노선인데 갈 때와 올 때가 4시간이나 다르다. 실제로는 양쪽 다 약 5시간
-- 30분이고, 오차가 정확히 한국–베트남 시차(2시간)의 두 배다. 미국 노선이면
-- 이 오차가 16시간이 된다(출발보다 이른 시각에 도착하는 것처럼 보인다).
--
-- ⚠️ **시각을 UTC 로 바꿔 저장하지 않는다.** 항공권에 적힌 숫자와 화면 숫자가
--    달라지는 순간 사람이 앱을 안 믿는다. 게다가 이미 들어 있는 값들은
--    어느 시간대인지 모르니 변환할 방법도 없다.
--    저장은 그대로 두고, **해석에 필요한 조각(시간대)만** 여기에 둔다.
--
-- ⚠️ IANA 이름으로 넣는다(`Asia/Seoul`). `+09:00` 같은 고정 오프셋으로 두면
--    **서머타임을 못 따라간다** — 미국·유럽·호주가 전부 틀어진다.
--    LAX 는 여름 UTC-7, 겨울 UTC-8 이다.

alter table public.airport_names
  add column if not exists tz text;

comment on column public.airport_names.tz is
  'IANA 시간대 이름. 소요시간·날짜넘김 계산에 쓴다. 모르면 null — 그때는 소요시간을 아예 안 보여준다.';

update public.airport_names set tz = v.tz from (values
  -- 한국
  ('ICN', 'Asia/Seoul'), ('GMP', 'Asia/Seoul'), ('PUS', 'Asia/Seoul'),
  ('CJU', 'Asia/Seoul'), ('TAE', 'Asia/Seoul'), ('CJJ', 'Asia/Seoul'),
  ('KWJ', 'Asia/Seoul'), ('MWX', 'Asia/Seoul'), ('RSU', 'Asia/Seoul'),
  ('USN', 'Asia/Seoul'), ('KPO', 'Asia/Seoul'), ('WJU', 'Asia/Seoul'),
  ('YNY', 'Asia/Seoul'), ('KUV', 'Asia/Seoul'), ('HIN', 'Asia/Seoul'),
  -- 일본 (서머타임 없음)
  ('NRT', 'Asia/Tokyo'), ('HND', 'Asia/Tokyo'), ('KIX', 'Asia/Tokyo'),
  ('FUK', 'Asia/Tokyo'), ('CTS', 'Asia/Tokyo'), ('OKA', 'Asia/Tokyo'),
  -- 동남아·중화권
  ('BKK', 'Asia/Bangkok'), ('DMK', 'Asia/Bangkok'),
  ('SGN', 'Asia/Ho_Chi_Minh'), ('HAN', 'Asia/Ho_Chi_Minh'), ('DAD', 'Asia/Ho_Chi_Minh'),
  ('SIN', 'Asia/Singapore'), ('HKG', 'Asia/Hong_Kong'), ('TPE', 'Asia/Taipei'),
  -- 중동
  ('DXB', 'Asia/Dubai'),
  -- 미주 (서머타임 있음 — 그래서 고정 오프셋을 쓰면 안 된다)
  ('LAX', 'America/Los_Angeles'), ('SFO', 'America/Los_Angeles'),
  ('JFK', 'America/New_York'),
  -- 유럽 (서머타임 있음)
  ('LHR', 'Europe/London'), ('CDG', 'Europe/Paris'),
  -- 오세아니아 (남반구라 서머타임 방향이 반대다)
  ('SYD', 'Australia/Sydney')
) as v(code, tz)
where public.airport_names.code = v.code;
