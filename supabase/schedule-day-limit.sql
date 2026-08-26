-- 일정의 일차 제한을 7일에서 30일로 넓힌다.
--
-- 신고: "여행클립 찜에 등록한 맛집을 일정으로 등록하면 등록이 안되요"
--
-- ## ⚠️ 7일이 넘는 여행이 이미 있다
--
-- 실측: 등록된 여행 중 「고베&오사카」가 **8일**이다. 그런데 제약이
-- `day_number <= 7` 이라 8일차 일정은 **DB 가 거부한다.** 앱의 일차 고르는
-- 칸도 1~7 뿐이라 애초에 8을 고를 수도 없었다.
--
-- 7일이라는 숫자에 근거가 없다. 열흘 넘는 여행은 흔하다.
--
-- ⚠️ 30일로 둔다. 무제한으로 열지 않는 이유는, 잘못된 값(예: 20260826)이
--    들어왔을 때 조용히 저장되면 화면이 통째로 망가지기 때문이다.
--    제약은 "있을 법한 범위" 를 지키는 용도로 남긴다.

alter table public.trip_schedules drop constraint if exists trip_schedules_day_number_check;
alter table public.trip_schedules
  add constraint trip_schedules_day_number_check
  check (day_number >= 1 and day_number <= 30);
