-- 팔로우 (페이즈 3 — 프로필)
--
-- 친구(friendships·맞팔 승인)와 다른 **비대칭** 관계다:
--   팔로워  = 구경꾼. 공개한 다녀온 코스만 본다. DM 못 보낸다.
--   친구    = 기존 friendships. 맛집 지도(근처만)까지 본다.
--
-- ⚠️ RLS: 걸기는 본인만, 읽기는 로그인 사용자 전부(프로필 숫자·목록이
--    누구에게나 보여야 한다). 사회 그래프가 회원에게 열리는 건 감수 —
--    인스타도 그렇다. anon 에게는 안 연다.

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_read" ON follows;
CREATE POLICY "follows_read" ON follows
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "follows_insert_own" ON follows;
CREATE POLICY "follows_insert_own" ON follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "follows_delete_own" ON follows;
CREATE POLICY "follows_delete_own" ON follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());
