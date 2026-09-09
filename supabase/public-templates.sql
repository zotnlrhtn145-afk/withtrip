-- 공개 여행 템플릿 (페이즈 2)
--
-- ⚠️ 실행 전에 알아둘 것
--   · RLS 정책은 건드리지 않는다. 공개 읽기는 Next.js 서버가 service role 로
--     읽고 코드에서 공개 필드만 골라 내보낸다(스크러빙). RLS 는 행 단위라
--     memo·member_ids 같은 「열」을 가릴 수 없기 때문이다.
--   · share_token 은 기본값을 두지 않는다 — 공유 버튼을 누를 때만 만든다.
--     (기본값으로 전 행에 깔면, 공유한 적 없는 여행에도 열쇠가 존재하게 된다)
--
-- 적용: Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 실행.

-- ── 1. trips 컬럼 ─────────────────────────────────────────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS share_token  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS fork_count   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tag_list     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trips_public_slug ON trips(slug) WHERE is_public = true;

-- ── 2. 복제 — DB 안에서 한 번에 (원자적) ─────────────────────────
-- ⚠️ 소유자를 파라미터로 받지 않는다. auth.uid() 만 믿는다 — 남의 계정에
--    복제본을 꽂는 걸 막는다. 그래서 이 함수는 로그인 세션이 실린
--    클라이언트로 불러야 한다 (service role 로 부르면 uid 가 없다).
CREATE OR REPLACE FUNCTION fork_trip(p_source_trip_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_new_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '로그인이 필요합니다';
  END IF;

  -- 공개 발행된 여행만 복제할 수 있다.
  -- (토큰 공유 여행은 안 된다 — 친구끼리 몰래 공유한 일정을 남이 통째로 가져가면 안 된다)
  INSERT INTO trips (user_id, title, location, start_date, end_date,
                     cover_image, description, tag_list, country_code, city,
                     kind, is_public)
  SELECT v_uid, title, location, start_date, end_date,
         cover_image, description, tag_list, country_code, city,
         'trip', false
  FROM trips
  WHERE id = p_source_trip_id AND is_public = true
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION '복제할 수 없는 여행입니다';
  END IF;

  -- 앱은 trip_members 로 여행 목록을 읽는다 — 빠지면 복제해도 안 보인다
  INSERT INTO trip_members (trip_id, user_id, role, status)
  VALUES (v_new_id, v_uid, 'owner', 'active');

  -- 일정만 복제한다. 항공·숙소·정산·메모·멤버는 원작자의 것이라 가져가지 않는다.
  -- created_by 는 새 주인으로, member_ids 는 비운다.
  INSERT INTO trip_schedules (trip_id, day_number, category, place_name,
                              visit_time, address, lat, lng, place_ref_id, created_by)
  SELECT v_new_id, day_number, category, place_name,
         visit_time, address, lat, lng, place_ref_id, v_uid
  FROM trip_schedules
  WHERE trip_id = p_source_trip_id;

  UPDATE trips SET fork_count = fork_count + 1 WHERE id = p_source_trip_id;

  RETURN v_new_id;
END;
$$;

-- 로그인한 사용자만 부를 수 있다
REVOKE ALL ON FUNCTION fork_trip(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION fork_trip(UUID) TO authenticated;
