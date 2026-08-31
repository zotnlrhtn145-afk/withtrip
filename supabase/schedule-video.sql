-- 일정에 **영상**도 남긴다.
--
-- ## ⚠️ 영상은 사진과 비용이 다르다
--
-- 사진 한 장은 300KB 인데 영상은 **수십 MB** 다. 목록을 내릴 때마다 영상을
-- 받으면 요금이 사진의 백 배로 뛴다. 그래서 규칙을 못박는다.
--
--   · 목록에는 **재생 딱지만** 그린다 (영상 바이트를 안 받는다)
--   · 영상은 **눌러서 크게 볼 때만** 받는다
--   · 길이는 앱에서 제한한다 (30초)
--
-- ⚠️ 미리보기 그림(포스터)을 따로 만들지 않는다. 만들려면 라이브러리가 하나
--    더 필요하고, 그 그림도 저장·전송 비용이 든다. 대신 어두운 칸에 ▶ 와
--    길이를 적는다 — 무엇인지 알아보는 데는 그것으로 충분하다.

alter table public.schedule_photos
  add column if not exists kind text not null default 'image',
  add column if not exists duration_sec integer;

comment on column public.schedule_photos.kind is
  'image | video. 기본은 image — 지금까지 올린 것은 전부 사진이다.';
comment on column public.schedule_photos.duration_sec is
  '영상 길이(초). 목록의 재생 딱지에 적는다. 사진이면 비어 있다.';
