-- 2층 일정 — 블록(큰 폭) (회의 확정: AI는 블록만, 장소는 사람이)
CREATE TABLE IF NOT EXISTS trip_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  start_time TEXT,          -- "11:00" (없으면 순서만)
  end_time TEXT,
  theme TEXT NOT NULL,      -- "숙소 근처 스파·수영"
  icon TEXT,                -- 🌅 🌇 🌃 같은 이모지 하나
  -- AI 제안은 proposed 로 들어오고, 사람이 ✓ 해야 confirmed 가 된다
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trip_blocks_trip ON trip_blocks(trip_id, day_number);

ALTER TABLE trip_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trip_blocks_member_rw ON trip_blocks;
CREATE POLICY trip_blocks_member_rw ON trip_blocks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_id AND (
      t.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = auth.uid())
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM trips t WHERE t.id = trip_id AND (
      t.user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM trip_members m WHERE m.trip_id = t.id AND m.user_id = auth.uid())
    )
  ));
