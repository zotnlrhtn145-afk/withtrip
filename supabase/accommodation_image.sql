-- 숙소(trip_accommodations)에 실제 호텔 사진 URL 저장 컬럼.
-- 구글 장소 검색(kind=stay)에서 가져온 호텔 사진을 그대로 노출 → 해당 호텔과 일치하는 이미지.
alter table public.trip_accommodations add column if not exists image_url text;
